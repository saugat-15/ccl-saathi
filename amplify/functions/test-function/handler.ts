import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { env } from '$amplify/env/testFunction.js';
import type { Schema } from '../../data/resource.js';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(
    env as typeof env & { AMPLIFY_DATA_DEFAULT_NAME: string },
);

Amplify.configure(resourceConfig, libraryOptions);
const dataClient = generateClient<Schema>();

export const handler = async (_event: unknown): Promise<{ statusCode: number; body: string }> => {
    try {
        const recordings = await dataClient.models.Recording.list();
        console.log('recordings', recordings);
        return {
            statusCode: 200,
            body: JSON.stringify(recordings),
        };
    } catch (error) {
        console.error('Error', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Error', error }),
        };
    }
};
