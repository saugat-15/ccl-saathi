import { defineFunction } from '@aws-amplify/backend';

export const postConfirmation = defineFunction({
  name: 'post-confirmation',
  entry: './handler.ts',
  runtime: 20,
  environment: {
    ADMIN_NOTIFY_EMAIL: 'saugatgiri15@gmail.com',
    SES_FROM_EMAIL: 'saugatgiri15@gmail.com',
  },
});
