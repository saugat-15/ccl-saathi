import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda for the NAATI/CCL pipeline (e.g. Transcribe, scoring).
 * Wire triggers (S3, EventBridge, data handlers) and IAM/storage in later steps.
 */
export const naatiProcessor = defineFunction({
    name: 'naati-processor',
    entry: './handler.ts',
    timeoutSeconds: 120,
    memoryMB: 512,
    runtime: 20,
    environment: {
        TRANSCRIBE_OUTPUT_PREFIX: 'naati-transcriptions/',
    },
});
