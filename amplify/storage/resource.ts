import { defineStorage } from '@aws-amplify/backend';
import { naatiProcessor } from '../functions/naatiProcessor/resource.js';

export const cclStorage = defineStorage({
    name: 'cclBucket',
    access: (allow) => ({
        'dialogues/*': [
            allow.authenticated.to(['read']), // authenticated users can read dialogues
            allow.resource(naatiProcessor).to(['read']), // Lambda can read (reference transcripts)
        ],
        'recordings/{entity_id}/*': [
            allow.entity('identity').to(['read', 'write', 'delete']), // user owns their recordings (≈ naati-user-recordings/{cognitoId}/…)
            allow.resource(naatiProcessor).to(['read']),
        ],
        'naati-transcriptions/*': [
            allow.resource(naatiProcessor).to(['read', 'write']), // merged pipeline + downstream scoring may read
        ],
    }),
    triggers: {
        onUpload: naatiProcessor,
    },
});