import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda for transcript post-processing: updates Recording/Transcription rows
 * when transcript JSON is uploaded.
 */
export const transcriptUpdater = defineFunction({
    name: 'transcriptUpdater',
    entry: './handler.ts',
    timeoutSeconds: 120,
    memoryMB: 512,
    runtime: 20,
    environment: {
        TRANSCRIPT_PREFIX: 'naati-transcriptions/',
        OPENAI_SCORER_MODEL: 'gpt-4.1-mini',
    },
});
