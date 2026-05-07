import type { PostAuthenticationTriggerHandler } from 'aws-lambda';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/post-authentication';
import type { Schema } from '../../data/resource';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>({ authMode: 'iam' });

/** Returns today's date in YYYY-MM-DD format (UTC). */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Returns yesterday's date in YYYY-MM-DD format (UTC). */
function yesterdayUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const MAX_LOGIN_DATES = 30;

export const handler: PostAuthenticationTriggerHandler = async (event) => {
  const sub = event.request.userAttributes.sub;
  const today = todayUTC();

  const { data: existing, errors } = await client.models.LoginStreak.list({
    filter: { userId: { eq: sub } },
  });

  if (errors?.length) {
    console.error('Error fetching LoginStreak:', errors);
    return event;
  }

  const record = existing?.[0];

  if (!record) {
    // First ever login — create the streak record
    await client.models.LoginStreak.create({
      userId: sub,
      currentStreak: 1,
      longestStreak: 1,
      lastLoginDate: today,
      isSuperUser: false,
      loginDates: [today],
    });
    console.log('LoginStreak created for', sub);
    return event;
  }

  // Already counted today — nothing to do
  if (record.lastLoginDate === today) {
    console.log('Login already tracked today for', sub);
    return event;
  }

  const yesterday = yesterdayUTC();
  const prevStreak = record.currentStreak ?? 0;
  const newStreak = record.lastLoginDate === yesterday ? prevStreak + 1 : 1;
  const newLongest = Math.max(record.longestStreak ?? 0, newStreak);
  const isSuperUser = record.isSuperUser || newStreak >= 5;

  const prevDates = record.loginDates ?? [];
  const loginDates = [...prevDates, today].slice(-MAX_LOGIN_DATES);

  await client.models.LoginStreak.update({
    id: record.id,
    currentStreak: newStreak,
    longestStreak: newLongest,
    lastLoginDate: today,
    isSuperUser,
    loginDates,
  });

  console.log(`LoginStreak updated for ${sub}: streak=${newStreak}, superUser=${isSuperUser}`);
  return event;
};
