/** User-safe copy for failed practice attempts (never expose internal/system errors). */
export const GENERIC_ATTEMPT_ERROR =
  "Something went wrong while processing this attempt. Please try again.";

/** Intentionally shown when a concurrent-processing limit is hit. */
export const RATE_LIMIT_ATTEMPT_ERROR =
  "You already have an attempt being processed. Please wait for it to complete.";

/**
 * Map a stored Recording.errorMessage to something safe for the UI.
 * Unknown / internal messages collapse to the generic copy.
 */
export function attemptFailureMessage(
  errorMessage: string | null | undefined,
): string {
  if (errorMessage === RATE_LIMIT_ATTEMPT_ERROR) return errorMessage;
  return GENERIC_ATTEMPT_ERROR;
}

const INTERNAL_ERROR_PATTERN =
  /invalid\s|failed to parse|econn|etimedout|secret|s3 object|stack|undefined|is not a function|typeerror|syntaxerror|graphql|amplify|openai|whisper|criticalerrors|segmentfeedback|missedterms|status code|internal server|accessdenied|not authorized|credentials|arn:aws|dynamodb|lambda/i;

/**
 * Prefer intentional, short user messages; collapse system/internal errors to fallback.
 */
export function toUserFacingError(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message.trim() : "";
  if (!msg) return fallback;
  if (msg.length > 180) return fallback;
  if (INTERNAL_ERROR_PATTERN.test(msg)) return fallback;
  return msg;
}
