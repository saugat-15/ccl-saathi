import { defineStorage } from '@aws-amplify/backend';
import { naatiProcessor } from '../functions/naatiProcessor/resource.js';

export const cclStorage = defineStorage({
    name: 'cclBucket',
    access: (allow) => ({
        'dialogues/*': [
            allow.authenticated.to(['read']), // authenticated users can read dialogues
            allow.resource(naatiProcessor).to(['read']), // Lambda can read
        ],
        'recordings/{entity_id}/*': [
            allow.entity('identity').to(['read', 'write', 'delete']), // user owns their recordings
            allow.resource(naatiProcessor).to(['read', 'write']),     // Lambda can read + write transcripts back
        ],
    }),
    triggers: {
        onUpload: naatiProcessor,
    },
});