import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda for the NAATI/CCL pipeline: OpenAI Whisper transcription → single JSON per recording in S3.
 */
export const testFunction = defineFunction({
    name: 'testFunction',
    entry: './handler.ts',
    resourceGroupName: 'testFunction',
    environment: {
        TRANSCRIBE_OUTPUT_PREFIX: 'naati-transcriptions/',
    },
});
