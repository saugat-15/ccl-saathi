const SCRIPT_URL = process.env.NEXT_PUBLIC_WAITLIST_SCRIPT_URL ?? "";

/**
 * Submits a waitlist entry to the Google Apps Script endpoint.
 * Uses no-cors + text/plain to avoid a CORS preflight, which AppScript doesn't support.
 * The response is always opaque — errors are swallowed so callers can treat this as fire-and-forget.
 */
export async function submitWaitlist({
  name,
  email,
  source,
}: {
  name: string;
  email: string;
  source: string;
}): Promise<void> {
  if (!SCRIPT_URL) return;
  await fetch(SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ name, email, source }),
  });
}
