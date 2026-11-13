import { describe, expect, it } from "vitest";

import {
  isValidAadhaar,
  isValidGstin,
  isValidPan,
  verhoeffValid,
} from "@/lib/kyc";
import { ageOn, dobError } from "@/lib/dates";
import {
  businessBody,
  fileError,
  firstIncompleteStep,
  memberBody,
  ownerBody,
  requiredDocuments,
  resumeStep,
  validateBusiness,
  validateOwner,
  validateTeam,
} from "./validate";

const yearsAgo = (n, dayShift = 0) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  d.setDate(d.getDate() + dayShift);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const business = {
  businessName: "Glow Salon",
  categoryId: "c1",
  gstNumber: "",
  line1: "12 MG Road",
  line2: "",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560001",
  businessPhone: "98111 11111",
  establishedOn: "2020-01-01",
  lat: "",
  lng: "",
};

describe("identity numbers (same rules as the server)", () => {
  it("PAN", () => {
    expect(isValidPan("ABCDE1234F")).toBe(true);
    expect(isValidPan("abcde 1234 f")).toBe(true);
    expect(isValidPan("ABCD1234F")).toBe(false);
    expect(isValidPan("12345ABCDE")).toBe(false);
  });
  it("GSTIN", () => {
    expect(isValidGstin("29ABCDE1234F1Z5")).toBe(true);
    expect(isValidGstin("29abcde1234f1z5")).toBe(true);
    expect(isValidGstin("29ABCDE1234F1X5")).toBe(
      false,
      "14th character must be Z",
    );
    expect(isValidGstin("29ABCDE1234F1Z")).toBe(false);
  });
  it("Aadhaar: 12 digits, not 0/1 first, Verhoeff check digit", () => {
    expect(isValidAadhaar("234123412346")).toBe(true);
    expect(isValidAadhaar("2341 2341 2346")).toBe(true);
    expect(isValidAadhaar("234123412345")).toBe(false, "wrong check digit");
    expect(isValidAadhaar("134123412346")).toBe(false, "starts with 1");
    expect(isValidAadhaar("23412341234")).toBe(false, "11 digits");
    expect(verhoeffValid("2363")).toBe(true);
  });
  it("ages and dates of birth", () => {
    expect(ageOn("2000-06-15", new Date(2026, 5, 14))).toBe(25);
    expect(ageOn("2000-06-15", new Date(2026, 5, 15))).toBe(26);
    expect(dobError(yearsAgo(18), 18)).toBe("");
    expect(dobError(yearsAgo(18, 1), 18, "The owner must")).toBe(
      "The owner must be at least 18",
    );
    expect(dobError(yearsAgo(111), 18)).toBe("Check the date of birth");
    expect(dobError(yearsAgo(-1), 18)).toBe(
      "Date of birth cannot be in the future",
    );
    expect(dobError("", 18)).toBe("Enter the date of birth");
  });
});

describe("business step", () => {
  it("valid → the exact body the server accepts", () => {
    expect(validateBusiness(business)).toEqual({});
    expect(
      businessBody({
        ...business,
        gstNumber: "29abcde1234f1z5",
        lat: "12.97",
        lng: "77.59",
      }),
    ).toEqual({
      businessName: "Glow Salon",
      categoryId: "c1",
      gstNumber: "29ABCDE1234F1Z5",
      address: {
        line1: "12 MG Road",
        line2: null,
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
      },
      location: { lat: 12.97, lng: 77.59 },
      businessPhone: "9811111111",
      establishedOn: "2020-01-01",
    });
    expect(businessBody(business).location).toBeNull();
    expect(businessBody(business).gstNumber).toBeNull();
  });
  it("every rule", () => {
    expect(
      validateBusiness({
        ...business,
        businessName: "G",
        categoryId: "",
        gstNumber: "BAD",
        line1: "x",
        city: "",
        state: "",
        pincode: "060001",
        businessPhone: "123",
        establishedOn: "",
      }),
    ).toEqual({
      businessName: "Enter the business name",
      categoryId: "Choose what kind of business it is",
      gstNumber: "Enter a valid 15-character GSTIN",
      line1: "Enter the shop address",
      city: "Enter the city",
      state: "Enter the state",
      pincode: "Enter a 6-digit pincode",
      businessPhone: "Enter a valid 10-digit mobile number",
      establishedOn: "Enter when the business started",
    });
    expect(
      validateBusiness({ ...business, establishedOn: yearsAgo(-1) })
        .establishedOn,
    ).toMatch(/future/);
    expect(validateBusiness({ ...business, lat: "12.9" }).location).toMatch(
      /both/,
    );
    expect(
      validateBusiness({ ...business, lat: "95", lng: "77" }).location,
    ).toMatch(/valid/);
  });
});

describe("owner step", () => {
  const owner = {
    name: "Asha Rao",
    dateOfBirth: yearsAgo(35),
    phone: "9822222221",
    pan: "ABCDE1234F",
    aadhaar: "2341 2341 2346",
  };
  it("first save needs PAN and Aadhaar; later saves may leave them blank", () => {
    expect(validateOwner(owner)).toEqual({});
    expect(validateOwner({ ...owner, pan: "", aadhaar: "" })).toEqual({
      pan: "Enter the owner PAN",
      aadhaar: "Enter the owner Aadhaar number",
    });
    expect(
      validateOwner(
        { ...owner, pan: "", aadhaar: "" },
        { panMasked: "******234F", aadhaarMasked: "XXXX XXXX 2346" },
      ),
    ).toEqual({});
  });
  it("invalid PAN / Aadhaar / under 18", () => {
    expect(
      validateOwner({
        ...owner,
        pan: "ABC",
        aadhaar: "234123412345",
        dateOfBirth: yearsAgo(17),
      }),
    ).toEqual({
      pan: "Enter a valid PAN, e.g. ABCDE1234F",
      aadhaar: "Enter a valid 12-digit Aadhaar number",
      dateOfBirth: "The owner must be at least 18",
    });
  });
  it("body: numbers normalised; blank numbers left out (keep what's on file)", () => {
    expect(ownerBody({ ...owner, pan: "abcde 1234 f" })).toEqual({
      name: "Asha Rao",
      dateOfBirth: owner.dateOfBirth,
      phone: "9822222221",
      pan: "ABCDE1234F",
      aadhaar: "234123412346",
    });
    expect(ownerBody({ ...owner, pan: "", aadhaar: "" })).toEqual({
      name: "Asha Rao",
      dateOfBirth: owner.dateOfBirth,
      phone: "9822222221",
    });
  });
});

describe("team step", () => {
  const m = (over = {}) => ({
    name: "Meera Nair",
    phone: "9833333331",
    role: "manager",
    dateOfBirth: "",
    gender: "",
    experienceYears: "",
    ...over,
  });
  it("repeated numbers and the owner's own number are refused", () => {
    const errors = validateTeam(
      [m(), m({ name: "Ravi" }), m({ phone: "9822222221" })],
      "9822222221",
    );
    expect(errors[0]).toEqual({});
    expect(errors[1].phone).toBe("Each person needs their own number");
    expect(errors[2].phone).toBe("That's the owner's number");
  });
  it("staff must be 14+; experience 0–80", () => {
    const [e] = validateTeam([
      m({ dateOfBirth: yearsAgo(13), experienceYears: "90" }),
    ]);
    expect(e).toEqual({
      dateOfBirth: "Must be at least 14",
      experienceYears: "0 to 80 years",
    });
  });
  it("body", () => {
    expect(
      memberBody(
        m({ phone: "+91 98333 33331", experienceYears: "3", gender: "female" }),
      ),
    ).toEqual({
      name: "Meera Nair",
      phone: "9833333331",
      role: "manager",
      dateOfBirth: null,
      gender: "female",
      experienceYears: 3,
    });
  });
});

describe("documents and resuming", () => {
  it("required documents: PAN + Aadhaar, and the GST certificate only with a GSTIN", () => {
    expect(requiredDocuments({ business: { gstNumber: null } })).toEqual([
      "pan_card",
      "aadhaar_card",
    ]);
    expect(
      requiredDocuments({ business: { gstNumber: "29ABCDE1234F1Z5" } }),
    ).toEqual(["pan_card", "aadhaar_card", "gst_certificate"]);
  });
  it("file checks: type and 5 MB", () => {
    expect(fileError({ type: "image/png", size: 1000 })).toBe("");
    expect(fileError({ type: "application/msword", size: 1000 })).toMatch(
      /JPEG, PNG, WebP or PDF/,
    );
    expect(
      fileError({ type: "application/pdf", size: 6 * 1024 * 1024 }),
    ).toMatch(/5 MB/);
  });
  it("resume: the step last open, never past the first one still incomplete", () => {
    expect(firstIncompleteStep(["business", "owner"])).toBe(0);
    expect(firstIncompleteStep(["owner", "document:pan_card"])).toBe(1);
    expect(firstIncompleteStep(["document:pan_card"])).toBe(3);
    expect(firstIncompleteStep([])).toBe(4);
    expect(resumeStep(["document:pan_card"], 2)).toBe(2);
    expect(resumeStep(["owner"], 3)).toBe(1);
    expect(resumeStep([], null)).toBe(4);
  });
});
