import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda for the NAATI/CCL pipeline: OpenAI Whisper transcription → single JSON per recording in S3.
 */
export const naatiProcessor = defineFunction({
    name: 'naati-processor',
    entry: './handler.ts',
    timeoutSeconds: 300,
    memoryMB: 512,
    runtime: 20,
    environment: {
        TRANSCRIBE_OUTPUT_PREFIX: 'naati-transcriptions/',
    },
});
