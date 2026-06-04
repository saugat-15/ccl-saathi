import { defineBackend } from '@aws-amplify/backend';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Stack } from 'aws-cdk-lib';
import { EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { naatiProcessor } from './functions/naatiProcessor/resource.js';
import { transcriptUpdater } from './functions/transcriptUpdater/resource.js';
import { postConfirmation } from './functions/postConfirmation/resource.js';
import { cclStorage as storage } from './storage/resource.js';

const backend = defineBackend({
  auth,
  data,
  storage,
  naatiProcessor,
  transcriptUpdater,
  postConfirmation,
});

backend.postConfirmation.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['ses:SendEmail', 'ses:SendRawEmail'],
    resources: ['*'],
  }),
);

const processorLambda = backend.naatiProcessor.resources.lambda as LambdaFunction;
const { account, region } = Stack.of(processorLambda);

/** Secret ARN suffix varies; wildcard matches the concrete secret and future rotations of the same name. */
const OPENAI_SECRET_RESOURCE_PATTERN =
  `arn:aws:secretsmanager:${region}:${account}:secret:OpenAI_API_KEY-*`;

processorLambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['secretsmanager:GetSecretValue'],
    resources: [OPENAI_SECRET_RESOURCE_PATTERN],
  }),
);

processorLambda.addEnvironment('TRANSCRIBE_OUTPUT_PREFIX', 'naati-transcriptions/');
processorLambda.addEnvironment('OPENAI_SECRET_ID', 'OpenAI_API_KEY');
processorLambda.addEnvironment('MAX_CONCURRENT_PROCESSING', '2');

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



// naatiProcessor updates Recording.status (PROCESSING / FAILED)

// transcriptUpdater creates Transcription row and marks Recording COMPLETED
updaterLambda.addEnvironment('OPENAI_SECRET_ID', 'OpenAI_API_KEY');

updaterLambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['secretsmanager:GetSecretValue'],
    resources: [OPENAI_SECRET_RESOURCE_PATTERN],
  }),
);
