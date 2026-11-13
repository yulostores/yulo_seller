// The onboarding forms' rules — a mirror of the server's (services/sellerOnboarding.service.js),
// so mistakes show up as they're typed. Each validator returns { field: message } (empty = valid)
// and each `toBody` builds exactly the JSON the server's strict schema accepts.

import {
  compact,
  isValidAadhaar,
  isValidGstin,
  isValidPan,
  isValidPincode,
} from "@/lib/kyc";
import { dobError, isFuture } from "@/lib/dates";
import { isValidPhone, toPhoneDigits } from "@/lib/phone";

export const MIN_OWNER_AGE = 18;
export const MIN_STAFF_AGE = 14;

const len = (v) => String(v ?? "").trim().length;

// ── Business ──────────────────────────────────────────────────────────────────
export function validateBusiness(f) {
  const e = {};
  if (len(f.businessName) < 2) e.businessName = "Enter the business name";
  else if (len(f.businessName) > 120) e.businessName = "At most 120 characters";
  if (!f.categoryId) e.categoryId = "Choose what kind of business it is";
  if (f.gstNumber && !isValidGstin(f.gstNumber))
    e.gstNumber = "Enter a valid 15-character GSTIN";
  if (len(f.line1) < 3) e.line1 = "Enter the shop address";
  if (len(f.city) < 2) e.city = "Enter the city";
  if (len(f.state) < 2) e.state = "Enter the state";
  if (!isValidPincode(f.pincode)) e.pincode = "Enter a 6-digit pincode";
  if (!isValidPhone(toPhoneDigits(f.businessPhone)))
    e.businessPhone = "Enter a valid 10-digit mobile number";
  if (!f.establishedOn) e.establishedOn = "Enter when the business started";
  else if (isFuture(f.establishedOn))
    e.establishedOn = "Establishment date cannot be in the future";
  const hasLat = f.lat !== "" && f.lat !== undefined && f.lat !== null;
  const hasLng = f.lng !== "" && f.lng !== undefined && f.lng !== null;
  if (hasLat !== hasLng)
    e.location = "Give both latitude and longitude, or neither";
  else if (
    hasLat &&
    (!(Math.abs(Number(f.lat)) <= 90) || !(Math.abs(Number(f.lng)) <= 180))
  )
    e.location = "That isn't a valid map position";
  return e;
}

export function businessBody(f) {
  const hasLocation =
    f.lat !== "" && f.lng !== "" && f.lat != null && f.lng != null;
  return {
    businessName: f.businessName.trim(),
    categoryId: f.categoryId,
    gstNumber: f.gstNumber ? compact(f.gstNumber) : null,
    address: {
      line1: f.line1.trim(),
      line2: f.line2?.trim() ? f.line2.trim() : null,
      city: f.city.trim(),
      state: f.state.trim(),
      pincode: String(f.pincode).trim(),
    },
    location: hasLocation ? { lat: Number(f.lat), lng: Number(f.lng) } : null,
    businessPhone: toPhoneDigits(f.businessPhone),
    establishedOn: f.establishedOn,
  };
}

// ── Owner ─────────────────────────────────────────────────────────────────────
/** `saved` = the masked numbers already on file ({ panMasked, aadhaarMasked }): then blank keeps them. */
export function validateOwner(f, saved = {}) {
  const e = {};
  if (len(f.name) < 2) e.name = "Enter the owner name";
  else if (len(f.name) > 100) e.name = "At most 100 characters";
  const dob = dobError(f.dateOfBirth, MIN_OWNER_AGE, "The owner must");
  if (dob) e.dateOfBirth = dob;
  if (!isValidPhone(toPhoneDigits(f.phone)))
    e.phone = "Enter a valid 10-digit mobile number";
  if (f.pan) {
    if (!isValidPan(f.pan)) e.pan = "Enter a valid PAN, e.g. ABCDE1234F";
  } else if (!saved.panMasked) e.pan = "Enter the owner PAN";
  if (f.aadhaar) {
    if (!isValidAadhaar(f.aadhaar))
      e.aadhaar = "Enter a valid 12-digit Aadhaar number";
  } else if (!saved.aadhaarMasked) e.aadhaar = "Enter the owner Aadhaar number";
  return e;
}

export function ownerBody(f) {
  return {
    name: f.name.trim(),
    dateOfBirth: f.dateOfBirth,
    phone: toPhoneDigits(f.phone),
    // Blank = keep what's on file. The numbers are never sent back to the screen.
    ...(f.pan ? { pan: compact(f.pan) } : {}),
    ...(f.aadhaar ? { aadhaar: compact(f.aadhaar) } : {}),
  };
}

// ── Team ──────────────────────────────────────────────────────────────────────
export const STAFF_ROLES = [
  { value: "employee", label: "Employee — redeems coupons" },
  { value: "manager", label: "Manager — reports, offers, employees" },
];

/** One team member's problems. */
export function validateMember(m) {
  const e = {};
  if (len(m.name) < 2) e.name = "Enter the name";
  else if (len(m.name) > 100) e.name = "At most 100 characters";
  if (!isValidPhone(toPhoneDigits(m.phone)))
    e.phone = "Enter a valid 10-digit mobile number";
  if (!m.role) e.role = "Choose a role";
  if (m.dateOfBirth) {
    const dob = dobError(m.dateOfBirth, MIN_STAFF_AGE);
    if (dob) e.dateOfBirth = dob;
  }
  if (m.experienceYears !== "" && m.experienceYears != null) {
    const n = Number(m.experienceYears);
    if (!Number.isFinite(n) || n < 0 || n > 80)
      e.experienceYears = "0 to 80 years";
  }
  return e;
}

/** Errors for the whole list, by row index; also catches repeated numbers and the owner's own. */
export function validateTeam(rows, ownerPhone) {
  const errors = rows.map(validateMember);
  const seen = new Map();
  rows.forEach((r, i) => {
    const phone = toPhoneDigits(r.phone);
    if (!isValidPhone(phone)) return;
    if (ownerPhone && phone === toPhoneDigits(ownerPhone))
      errors[i].phone = "That's the owner's number";
    else if (seen.has(phone))
      errors[i].phone = "Each person needs their own number";
    seen.set(phone, i);
  });
  return errors;
}

export function memberBody(m) {
  return {
    name: m.name.trim(),
    phone: toPhoneDigits(m.phone),
    role: m.role,
    dateOfBirth: m.dateOfBirth || null,
    gender: m.gender || null,
    experienceYears:
      m.experienceYears === "" || m.experienceYears == null
        ? null
        : Number(m.experienceYears),
  };
}

// ── Documents ─────────────────────────────────────────────────────────────────
export const DOCUMENT_TYPES = {
  pan_card: "PAN card",
  aadhaar_card: "Aadhaar card",
  gst_certificate: "GST certificate",
  shop_photo: "Shop photo",
  business_registration: "Business registration",
  other: "Other document",
};
export const DOCUMENT_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

/** The document types required for this application (GST certificate only with a GSTIN). */
export const requiredDocuments = (form) => [
  "pan_card",
  "aadhaar_card",
  ...(form?.business?.gstNumber ? ["gst_certificate"] : []),
];

export function fileError(file) {
  if (!file) return "Choose a file";
  if (!DOCUMENT_MIME.includes(file.type))
    return "Only JPEG, PNG, WebP or PDF files";
  if (file.size > DOCUMENT_MAX_BYTES) return "The file is larger than 5 MB";
  return "";
}

// ── Steps and resuming ────────────────────────────────────────────────────────
export const STEPS = [
  { key: "business", label: "Business" },
  { key: "owner", label: "Owner" },
  { key: "team", label: "Team" },
  { key: "documents", label: "Documents" },
  { key: "review", label: "Review & submit" },
];

/** The first step with something required still missing (the team is optional); else review. */
export function firstIncompleteStep(missing = []) {
  if (missing.includes("business")) return 0;
  if (missing.includes("owner")) return 1;
  if (missing.some((m) => m.startsWith("document:"))) return 3;
  return 4;
}

/** Where to resume: the step last open, but never past the first one still incomplete. */
export function resumeStep(missing, storedIndex) {
  const first = firstIncompleteStep(missing);
  return Number.isInteger(storedIndex) && storedIndex >= 0
    ? Math.min(storedIndex, first)
    : first;
}

export const MISSING_LABELS = (key) =>
  key === "business"
    ? "Business details"
    : key === "owner"
      ? "Owner details (with PAN and Aadhaar)"
      : key.startsWith("document:")
        ? `${DOCUMENT_TYPES[key.slice(9)] ?? key.slice(9)} upload`
        : key;
