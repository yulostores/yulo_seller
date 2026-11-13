// Coupon codes as the counter types or scans them. Same alphabet as the server
// (yulo_backend/server/utils/couponCode.js): 10 characters, no 0/O, 1/I/L or U — so nothing a
// customer reads out can be mistaken for something else.

export const CODE_LENGTH = 10;
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

/** What was typed or scanned → upper case, without spaces / dashes / anything else, ≤ 10 chars. */
export function cleanCode(input) {
  return String(input ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CODE_LENGTH);
}

/** True when this could be a coupon code (the server is the judge of whether it is one). */
export function isCompleteCode(code) {
  return (
    code.length === CODE_LENGTH &&
    [...code].every((ch) => CODE_ALPHABET.includes(ch))
  );
}

/** "KM4T7QXH2P" → "KM4T7-QXH2P" for reading back to a customer. */
export const displayCode = (code) =>
  code.length > 5 ? `${code.slice(0, 5)}-${code.slice(5)}` : code;

/** The code inside a scanned QR: the whole payload (QR payload = code), cleaned. Null when it isn't one. */
export function codeFromQr(text) {
  const code = cleanCode(text);
  return isCompleteCode(code) &&
    String(text).replace(/[\s-]/g, "").length === CODE_LENGTH
    ? code
    : null;
}
