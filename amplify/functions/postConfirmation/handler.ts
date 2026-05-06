import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/post-confirmation';
import type { Schema } from '../../data/resource';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>({ authMode: 'iam' });

export const handler: PostConfirmationTriggerHandler = async (event) => {
  if (event.triggerSource === 'PostConfirmation_ConfirmSignUp') {
    const { sub } = event.request.userAttributes;

    const { data: existing } = await client.models.User.get(
      { id: sub },
    );

    if (!existing) {
      // owner format matches what AppSync sets for userPool auth: sub::username
      console.log('user does not exist, creating user', sub);
      const createUser = await client.models.User.create(
        {
          id: sub,
          hasSubscription: false,
          freeAttempts: 0,
        },
      );
      if (createUser.errors) {
        console.error('error creating user', createUser.errors);
        throw new Error(createUser.errors[0].message);
      }
      console.log('user created', createUser.data?.id);
    } else {
      console.log('user already exists', existing?.id);
    }
  }

  return event;
};
