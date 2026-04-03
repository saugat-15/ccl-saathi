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

const bucketArn = backend.storage.resources.bucket.bucketArn;

/** Secret ARN suffix varies; wildcard matches the concrete secret and future rotations of the same name. */
const OPENAI_SECRET_RESOURCE_PATTERN =
  'arn:aws:secretsmanager:ap-southeast-2:025711718416:secret:OpenAI_API_KEY-*';

const transcribeAccessRole = new iam.Role(backend.stack, 'TranscribeDataAccessRole', {
  assumedBy: new iam.ServicePrincipal('transcribe.amazonaws.com'),
  description:
    'Grants Amazon Transcribe access to user recordings and transcript output prefix',
});

transcribeAccessRole.addToPolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['s3:GetObject'],
    resources: [`${bucketArn}/recordings/*`],
  }),
);
transcribeAccessRole.addToPolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['s3:PutObject'],
    resources: [`${bucketArn}/naati-transcriptions/*`],
  }),
);

const processorLambda = backend.naatiProcessor.resources.lambda as LambdaFunction;

processorLambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['transcribe:StartTranscriptionJob', 'transcribe:GetTranscriptionJob'],
    resources: ['*'],
  }),
);

processorLambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['iam:PassRole'],
    resources: [transcribeAccessRole.roleArn],
    conditions: {
      StringEquals: {
        'iam:PassedToService': 'transcribe.amazonaws.com',
      },
    },
  }),
);

processorLambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['secretsmanager:GetSecretValue'],
    resources: [OPENAI_SECRET_RESOURCE_PATTERN],
  }),
);

processorLambda.addEnvironment(
  'TRANSCRIBE_ACCESS_ROLE_ARN',
  transcribeAccessRole.roleArn,
);
processorLambda.addEnvironment(
  'TRANSCRIBE_OUTPUT_PREFIX',
  'naati-transcriptions/',
);
processorLambda.addEnvironment(
  'OPENAI_SECRET_ID',
  'OpenAI_API_KEY',
);
