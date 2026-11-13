// User-facing text for a caught error. The API client turns every failed response into an Error
// with the server's `code` / `status`; anything without them came from the browser (a bug, a
// dropped connection) and its raw message means nothing to a shopkeeper.

const FRIENDLY = {
  UNAUTHORIZED: "Your session has ended. Please sign in again.",
  TOKEN_EXPIRED: "Your session has ended. Please sign in again.",
  INVALID_TOKEN: "Your session has ended. Please sign in again.",
  RATE_LIMITED: "Too many attempts. Please wait a minute and try again.",
  SELLER_NOT_ACTIVE: "Your business isn't approved yet.",
  FORBIDDEN: "Your role can't do this.",
  INVALID_OTP: "That code is not right. Check the SMS and try again.",
  OTP_EXPIRED: "That code has expired. Ask for a new one.",
  PHONE_ALREADY_REGISTERED:
    "This number already owns a business on Yulo. Sign in instead.",
};

export function isApiError(err) {
  return Boolean(err && (err.code || err.status));
}

export function errorMessage(
  err,
  fallback = "Something went wrong. Please try again.",
) {
  if (!isApiError(err)) return fallback;
  if (err.code && FRIENDLY[err.code]) return FRIENDLY[err.code];
  if (err.status >= 500)
    return "The server is having trouble right now. Please try again.";
  return err.message || fallback;
}

/** The first field message of a 400 VALIDATION_ERROR, if any. */
export function fieldError(err, field) {
  return err?.details?.fieldErrors?.[field]?.[0] ?? null;
}
