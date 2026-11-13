// Identity-number checks — the same rules the server applies (yulo_backend/server/utils/kyc.js),
// so a typo is caught as it is typed rather than after a round trip. The server checks again.
// Inputs are normalised first (spaces and dashes removed, upper case), the way people type them.

export const compact = (value) =>
  typeof value === "string" ? value.replace(/[\s-]/g, "").toUpperCase() : "";

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const isValidPan = (value) => PAN_RE.test(compact(value));

// The restaurant settings' pattern (server config/storeSettings.config.js GSTIN_PATTERN).
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const isValidGstin = (value) => GSTIN_RE.test(compact(value));

// Aadhaar check digit (Verhoeff, as UIDAI issues them) — kept for reference; not enforced.
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 8, 7, 6, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
export const verhoeffValid = (digits) => {
  if (!/^\d+$/.test(digits)) return false;
  let c = 0;
  [...digits].reverse().forEach((ch, i) => {
    c = D[c][P[i % 8][Number(ch)]];
  });
  return c === 0;
};
// Format only (12 digits, not starting 0/1) — the check digit is not enforced, same as the server
// (yulo_backend/server/utils/kyc.js).
export const isValidAadhaar = (value) => /^[2-9]\d{11}$/.test(compact(value));

export const isValidPincode = (value) =>
  /^[1-9][0-9]{5}$/.test(String(value ?? "").trim());
