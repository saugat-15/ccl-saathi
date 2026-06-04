import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/post-confirmation';
import type { Schema } from '../../data/resource';
import { notifyAdminNewSignup } from './notifyAdminSignup';

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
      const createUser = await client.models.User.create({ id: sub });
      if (createUser.errors) {
        console.error('error creating user', createUser.errors);
        throw new Error(createUser.errors[0].message);
      }
      console.log('user created', createUser.data?.id);

      try {
        await notifyAdminNewSignup({
          userId: sub,
          email: event.request.userAttributes.email,
          givenName: event.request.userAttributes.given_name,
          familyName: event.request.userAttributes.family_name,
        });
        console.log('admin signup notification sent');
      } catch (err) {
        console.error('failed to send admin signup notification', err);
      }
    } else {
      console.log('user already exists', existing?.id);
    }

    // Always ensure a BillingProfile exists — handles accounts created before
    // BillingProfile was introduced, or cases where the previous run failed mid-way.
    const { data: billingData } = await client.models.BillingProfile.list({
      filter: { userId: { eq: sub } },
    });
    if (!billingData?.[0]) {
      const createBilling = await client.models.BillingProfile.create({
        userId: sub,
        hasSubscription: false,
        freeAttempts: 0,
      });
      if (createBilling.errors) {
        console.error('error creating billing profile', createBilling.errors);
        throw new Error(createBilling.errors[0].message);
      }
      console.log('billing profile created', createBilling.data?.userId);
    } else {
      console.log('billing profile already exists', billingData[0].userId);
    }
  }

  return event;
};
