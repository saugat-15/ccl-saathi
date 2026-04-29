import { defineBackend } from '@aws-amplify/backend';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import { GraphqlApi } from 'aws-cdk-lib/aws-appsync';
import * as iam from 'aws-cdk-lib/aws-iam';
import { EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { naatiProcessor } from './functions/naatiProcessor/resource.js';
import { transcriptUpdater } from './functions/transcriptUpdater/resource.js';
import { cclStorage as storage } from './storage/resource.js';

const backend = defineBackend({
  auth,
  data,
  storage,
  naatiProcessor,
  transcriptUpdater,
});

/** Secret ARN suffix varies; wildcard matches the concrete secret and future rotations of the same name. */
const OPENAI_SECRET_RESOURCE_PATTERN =
  'arn:aws:secretsmanager:ap-southeast-2:025711718416:secret:OpenAI_API_KEY-*';

const processorLambda = backend.naatiProcessor.resources.lambda as LambdaFunction;

processorLambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['secretsmanager:GetSecretValue'],
    resources: [OPENAI_SECRET_RESOURCE_PATTERN],
  }),
);

processorLambda.addEnvironment('TRANSCRIBE_OUTPUT_PREFIX', 'naati-transcriptions/');
processorLambda.addEnvironment('OPENAI_SECRET_ID', 'OpenAI_API_KEY');

// ── S3 event notifications ────────────────────────────────────────────────────

const bucket = backend.storage.resources.bucket;

// User uploads a recording → trigger naatiProcessor
bucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(processorLambda),
  { prefix: 'protected/' },
);

// naatiProcessor writes transcript JSON → trigger transcriptUpdater
const updaterLambda = backend.transcriptUpdater.resources.lambda as LambdaFunction;

bucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(updaterLambda),
  { prefix: 'naati-transcriptions/', suffix: '.json' },
);

// ── AppSync access ────────────────────────────────────────────────────────────

const graphqlApi = backend.data.resources.graphqlApi as GraphqlApi;

// naatiProcessor updates Recording.status (PROCESSING / FAILED)
graphqlApi.grant(processorLambda, appsync.IamResource.all(), 'appsync:GraphQL');
processorLambda.addEnvironment('AMPLIFY_DATA_GRAPHQL_ENDPOINT', graphqlApi.graphqlUrl);

// transcriptUpdater creates Transcription row and marks Recording COMPLETED
graphqlApi.grant(updaterLambda, appsync.IamResource.all(), 'appsync:GraphQL');
updaterLambda.addEnvironment('AMPLIFY_DATA_GRAPHQL_ENDPOINT', graphqlApi.graphqlUrl);
updaterLambda.addEnvironment('OPENAI_SECRET_ID', 'OpenAI_API_KEY');

updaterLambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['secretsmanager:GetSecretValue'],
    resources: [OPENAI_SECRET_RESOURCE_PATTERN],
  }),
);
