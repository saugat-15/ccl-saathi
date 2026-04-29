import { defineStorage } from '@aws-amplify/backend';
import { naatiProcessor } from '../functions/naatiProcessor/resource.js';
import { transcriptUpdater } from '../functions/transcriptUpdater/resource.js';

export const cclStorage = defineStorage({
    name: 'cclBucket',
    access: (allow) => ({
        'dialogues/*': [
            allow.authenticated.to(['read']), // authenticated users can read dialogues
            allow.resource(naatiProcessor).to(['read']), // Lambda can read (reference transcripts)
            allow.resource(transcriptUpdater).to(['read']),
        ],
        'protected/{entity_id}/*': [
            allow.entity('identity').to(['read', 'write', 'delete']), // user owns their recordings under protected identity scope
            allow.resource(naatiProcessor).to(['read', 'write']),
            allow.resource(transcriptUpdater).to(['read']),
        ],
        'naati-transcriptions/*': [
            allow.resource(naatiProcessor).to(['read', 'write']),
            allow.resource(transcriptUpdater).to(['read']),
        ],
    }),
});