import { fieldError } from "@/lib/errors";

/**
 * A 400 VALIDATION_ERROR's field messages as { field: message } (null when there are none).
 * `rename` maps server field names to the form's (e.g. "address.city" → "city").
 */
export function serverFieldErrors(err, rename = {}) {
  const fields =
    err?.code === "VALIDATION_ERROR" ? err.details?.fieldErrors : null;
  if (!fields || !Object.keys(fields).length) return null;
  const out = {};
  for (const key of Object.keys(fields))
    out[rename[key] ?? key] = fieldError(err, key);
  return out;
}
