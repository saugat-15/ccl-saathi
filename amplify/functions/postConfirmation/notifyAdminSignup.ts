import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({});

const ADMIN_NOTIFY_EMAIL =
  process.env.ADMIN_NOTIFY_EMAIL ?? 'saugatgiri15@gmail.com';
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL ?? 'saugatgiri15@gmail.com';

export type NewSignupDetails = {
  userId: string;
  email?: string;
  givenName?: string;
  familyName?: string;
};

export async function notifyAdminNewSignup(details: NewSignupDetails): Promise<void> {
  const { userId, email, givenName, familyName } = details;
  const name = [givenName, familyName].filter(Boolean).join(' ') || '—';
  const signedUpAt = new Date().toISOString();

  const subject = 'CCLSaathi: New user signed up';
  const text = [
    'A new user confirmed their account on CCLSaathi.',
    '',
    `Email: ${email ?? '—'}`,
    `User ID: ${userId}`,
    `Name: ${name}`,
    `Signed up at (UTC): ${signedUpAt}`,
  ].join('\n');

  const html = `
    <p>A new user confirmed their account on <strong>CCLSaathi</strong>.</p>
    <ul>
      <li><strong>Email:</strong> ${escapeHtml(email ?? '—')}</li>
      <li><strong>User ID:</strong> ${escapeHtml(userId)}</li>
      <li><strong>Name:</strong> ${escapeHtml(name)}</li>
      <li><strong>Signed up at (UTC):</strong> ${escapeHtml(signedUpAt)}</li>
    </ul>
  `.trim();

  await ses.send(
    new SendEmailCommand({
      Source: SES_FROM_EMAIL,
      Destination: { ToAddresses: [ADMIN_NOTIFY_EMAIL] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Text: { Data: text, Charset: 'UTF-8' },
          Html: { Data: html, Charset: 'UTF-8' },
        },
      },
    }),
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
