import { defineBackend } from '@aws-amplify/backend';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { naatiProcessor } from './functions/naatiProcessor/resource.js';
import { cclStorage as storage } from './storage/resource.js';

const backend = defineBackend({
  auth,
  data,
  storage,
  naatiProcessor,
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

processorLambda.addEnvironment(
  'TRANSCRIBE_OUTPUT_PREFIX',
  'naati-transcriptions/',
);
processorLambda.addEnvironment(
  'OPENAI_SECRET_ID',
  'OpenAI_API_KEY',
);
