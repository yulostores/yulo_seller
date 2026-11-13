import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/api/seller.api", () => ({
  onboardingApi: {
    get: vi.fn(),
    saveBusiness: vi.fn(),
    saveOwner: vi.fn(),
    saveEmployees: vi.fn(),
    uploadDocument: vi.fn(),
    deleteDocument: vi.fn(),
    documentFile: vi.fn(),
    submit: vi.fn(),
    status: vi.fn(),
  },
  categoriesApi: { list: vi.fn() },
  accountApi: {},
  teamApi: {},
}));

import { categoriesApi, onboardingApi } from "@/api/seller.api";
import { apiError, renderWith } from "@/test/renderWith";
import { makeSession } from "@/test/sessions";
import OnboardingWizard from "./OnboardingWizard";

const FULL_PAN = "ABCDE1234F";
const FULL_AADHAAR = "234123412346";

/** The server's onboarding view, as GET/PUT /seller/onboarding return it. */
function view(over = {}) {
  return {
    status: "pending",
    submittedAt: null,
    rejectionReason: null,
    editable: true,
    editableBusinessFields: [],
    business: {
      businessName: "Glow Salon",
      categoryId: null,
      category: null,
      gstNumber: null,
      address: null,
      location: null,
      businessPhone: null,
      establishedOn: null,
    },
    owner: {
      name: "Asha Rao",
      dateOfBirth: null,
      phone: "9822222221",
      panMasked: null,
      aadhaarMasked: null,
    },
    employees: [],
    documents: [],
    missing: [
      "business",
      "owner",
      "document:pan_card",
      "document:aadhaar_card",
    ],
    ...over,
  };
}
const businessDone = {
  businessName: "Glow Salon",
  categoryId: "c-salon",
  category: { _id: "c-salon", key: "salon", name: "Salon" },
  gstNumber: null,
  address: {
    line1: "12 MG Road",
    line2: null,
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
  },
  location: { lat: 12.97, lng: 77.59 },
  businessPhone: "9811111111",
  establishedOn: "2020-01-01T00:00:00.000Z",
};
const ownerDone = {
  name: "Asha Rao",
  dateOfBirth: "1990-05-05T00:00:00.000Z",
  phone: "9822222221",
  panMasked: "******234F",
  aadhaarMasked: "XXXX XXXX 2346",
};

const session = makeSession({ role: "owner", status: "pending" });
const STEP_KEY = `yulo_seller_onboarding_step:${session.seller._id}`;
const render = (auth) =>
  renderWith(<OnboardingWizard />, { session, path: "/onboarding", auth });
const currentStep = () =>
  screen.getByRole("button", { current: "step" }).textContent;

beforeEach(() => {
  localStorage.clear();
  categoriesApi.list.mockResolvedValue([
    { _id: "c-salon", key: "salon", name: "Salon", icon: null },
    { _id: "c-spa", key: "spa", name: "Spa", icon: null },
  ]);
});
afterEach(() => vi.clearAllMocks());

async function fillBusiness(user) {
  await screen.findByRole("option", { name: "Salon" });
  await user.clear(screen.getByLabelText("Business name"));
  await user.type(screen.getByLabelText("Business name"), "Glow Salon");
  await user.selectOptions(screen.getByLabelText("Category"), "c-salon");
  await user.type(screen.getByLabelText("Shop phone"), "9811111111");
  await user.type(screen.getByLabelText("Started on"), "2020-01-01");
  await user.type(screen.getByLabelText("Address line 1"), "12 MG Road");
  await user.type(screen.getByLabelText("City"), "Bengaluru");
  await user.type(screen.getByLabelText("State"), "Karnataka");
  await user.type(screen.getByLabelText("Pincode"), "560001");
}

describe("Onboarding wizard", () => {
  it("a new application starts at Business; invalid input shows every problem and saves nothing", async () => {
    onboardingApi.get.mockResolvedValue(view());
    const user = userEvent.setup();
    render();
    await screen.findByLabelText("Business name");
    expect(currentStep()).toContain("Business");
    await user.clear(screen.getByLabelText("Business name"));
    await user.type(screen.getByLabelText("GSTIN (optional)"), "NOT-A-GSTIN");
    await user.click(screen.getByRole("button", { name: "Save and continue" }));
    for (const msg of [
      "Enter the business name",
      "Choose what kind of business it is",
      "Enter a valid 15-character GSTIN",
      "Enter the shop address",
      "Enter a 6-digit pincode",
      "Enter a valid 10-digit mobile number",
    ]) {
      expect(screen.getByText(msg)).toBeTruthy();
    }
    expect(onboardingApi.saveBusiness).not.toHaveBeenCalled();
  });

  it("Business: valid input is saved and the wizard moves on to Owner", async () => {
    onboardingApi.get.mockResolvedValue(view());
    onboardingApi.saveBusiness.mockResolvedValue(
      view({
        business: businessDone,
        missing: ["owner", "document:pan_card", "document:aadhaar_card"],
      }),
    );
    const user = userEvent.setup();
    render();
    await screen.findByLabelText("Business name");
    await fillBusiness(user);
    await user.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(onboardingApi.saveBusiness).toHaveBeenCalledWith({
      businessName: "Glow Salon",
      categoryId: "c-salon",
      gstNumber: null,
      address: {
        line1: "12 MG Road",
        line2: null,
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
      },
      location: null,
      businessPhone: "9811111111",
      establishedOn: "2020-01-01",
    });
    await screen.findByLabelText("Owner name");
    expect(currentStep()).toContain("Owner");
    expect(localStorage.getItem(STEP_KEY)).toBe("1");
  });

  it("Business: the server's field errors land on the fields", async () => {
    onboardingApi.get.mockResolvedValue(view());
    onboardingApi.saveBusiness.mockRejectedValue(
      apiError(400, "VALIDATION_ERROR", "Invalid", {
        fieldErrors: {
          categoryId: ["Unknown category"],
          "address.city": ["Enter the city"],
        },
      }),
    );
    const user = userEvent.setup();
    render();
    await screen.findByLabelText("Business name");
    await fillBusiness(user);
    await user.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(await screen.findByText("Unknown category")).toBeTruthy();
  });

  it("Owner: PAN, Aadhaar (checksum) and 18+ are checked before saving", async () => {
    onboardingApi.get.mockResolvedValue(
      view({
        business: businessDone,
        missing: ["owner", "document:pan_card", "document:aadhaar_card"],
      }),
    );
    const user = userEvent.setup();
    render();
    await screen.findByLabelText("Owner name");
    const tooYoung = new Date();
    tooYoung.setFullYear(tooYoung.getFullYear() - 17);
    await user.type(
      screen.getByLabelText("Date of birth"),
      tooYoung.toISOString().slice(0, 10),
    );
    await user.type(screen.getByLabelText("PAN"), "ABC123");
    await user.type(screen.getByLabelText("Aadhaar number"), "234123412345");
    await user.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(screen.getByText("The owner must be at least 18")).toBeTruthy();
    expect(screen.getByText("Enter a valid PAN, e.g. ABCDE1234F")).toBeTruthy();
    expect(
      screen.getByText("Enter a valid 12-digit Aadhaar number"),
    ).toBeTruthy();
    expect(onboardingApi.saveOwner).not.toHaveBeenCalled();
  });

  it("Owner: after saving, PAN and Aadhaar only ever appear masked — never the numbers", async () => {
    onboardingApi.get.mockResolvedValue(
      view({
        business: businessDone,
        missing: ["owner", "document:pan_card", "document:aadhaar_card"],
      }),
    );
    onboardingApi.saveOwner.mockResolvedValue(
      view({
        business: businessDone,
        owner: ownerDone,
        missing: ["document:pan_card", "document:aadhaar_card"],
      }),
    );
    const user = userEvent.setup();
    const { container } = render();
    await screen.findByLabelText("Owner name");
    await user.type(screen.getByLabelText("Date of birth"), "1990-05-05");
    await user.type(screen.getByLabelText("PAN"), "abcde 1234 f");
    await user.type(screen.getByLabelText("Aadhaar number"), "2341 2341 2346");
    await user.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(onboardingApi.saveOwner).toHaveBeenCalledWith({
      name: "Asha Rao",
      dateOfBirth: "1990-05-05",
      phone: "9822222221",
      pan: FULL_PAN,
      aadhaar: FULL_AADHAAR,
    });

    // Moves on to Team; going back to Owner shows only the masked values, inputs empty.
    await screen.findByText("No team members yet.");
    await user.click(screen.getByRole("button", { name: /Owner/ }));
    expect(screen.getByLabelText("PAN").value).toBe("");
    expect(screen.getByLabelText("Aadhaar number").value).toBe("");
    expect(
      screen.getByText("On file: ******234F — leave blank to keep it"),
    ).toBeTruthy();
    expect(
      screen.getByText("On file: XXXX XXXX 2346 — leave blank to keep it"),
    ).toBeTruthy();
    expect(container.innerHTML).not.toContain(FULL_PAN);
    expect(container.innerHTML).not.toContain(FULL_AADHAAR);
    expect(container.innerHTML).not.toContain("2341 2341 2346");

    // Saving again with the numbers left blank keeps them (they are not sent).
    onboardingApi.saveOwner.mockClear();
    await user.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(onboardingApi.saveOwner).toHaveBeenCalledWith({
      name: "Asha Rao",
      dateOfBirth: "1990-05-05",
      phone: "9822222221",
    });
  });

  it("Team: add people (repeats and the owner's number refused), save, or skip", async () => {
    onboardingApi.get.mockResolvedValue(
      view({
        business: businessDone,
        owner: ownerDone,
        missing: ["document:pan_card", "document:aadhaar_card"],
      }),
    );
    localStorage.setItem(STEP_KEY, "2");
    const user = userEvent.setup();
    render();
    await screen.findByText("No team members yet.");
    expect(currentStep()).toContain("Team");
    await user.click(screen.getByRole("button", { name: "Add a person" }));
    await user.click(screen.getByRole("button", { name: "Add a person" }));
    const [first, second] = screen.getAllByRole("group", {
      name: /Team member/,
    });
    await user.type(within(first).getByLabelText("Name"), "Meera Nair");
    await user.type(within(first).getByLabelText("Mobile"), "9822222221");
    await user.selectOptions(within(first).getByLabelText("Role"), "manager");
    await user.type(within(second).getByLabelText("Name"), "Ravi Kumar");
    await user.type(within(second).getByLabelText("Mobile"), "9700000002");
    await user.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(within(first).getByText("That's the owner's number")).toBeTruthy();
    expect(onboardingApi.saveEmployees).not.toHaveBeenCalled();

    await user.clear(within(first).getByLabelText("Mobile"));
    await user.type(within(first).getByLabelText("Mobile"), "9833333331");
    onboardingApi.saveEmployees.mockResolvedValue(
      view({
        business: businessDone,
        owner: ownerDone,
        employees: [
          {
            _id: "e1",
            name: "Meera Nair",
            phone: "9833333331",
            role: "manager",
            isActive: false,
          },
        ],
        missing: ["document:pan_card", "document:aadhaar_card"],
      }),
    );
    await user.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(onboardingApi.saveEmployees).toHaveBeenCalledWith([
      {
        name: "Meera Nair",
        phone: "9833333331",
        role: "manager",
        dateOfBirth: null,
        gender: null,
        experienceYears: null,
      },
      {
        name: "Ravi Kumar",
        phone: "9700000002",
        role: "employee",
        dateOfBirth: null,
        gender: null,
        experienceYears: null,
      },
    ]);
    expect(await screen.findByTestId("doc-pan_card")).toBeTruthy();
  });

  it("Team can be skipped when empty", async () => {
    onboardingApi.get.mockResolvedValue(
      view({
        business: businessDone,
        owner: ownerDone,
        missing: ["document:pan_card", "document:aadhaar_card"],
      }),
    );
    localStorage.setItem(STEP_KEY, "2");
    const user = userEvent.setup();
    render();
    await user.click(
      await screen.findByRole("button", { name: "Skip for now" }),
    );
    expect(await screen.findByTestId("doc-pan_card")).toBeTruthy();
    expect(onboardingApi.saveEmployees).not.toHaveBeenCalled();
  });

  it("Documents: wrong type / too large refused locally; upload, view and remove", async () => {
    onboardingApi.get.mockResolvedValue(
      view({
        business: { ...businessDone, gstNumber: "29ABCDE1234F1Z5" },
        owner: ownerDone,
        missing: [
          "document:pan_card",
          "document:aadhaar_card",
          "document:gst_certificate",
        ],
      }),
    );
    const user = userEvent.setup({ applyAccept: false });
    render();
    const pan = await screen.findByTestId("doc-pan_card");
    expect(screen.getByTestId("doc-gst_certificate")).toBeTruthy();
    expect(within(pan).getByText("Required")).toBeTruthy();

    await user.upload(
      screen.getByLabelText("Upload PAN card"),
      new File(["x"], "pan.doc", { type: "application/msword" }),
    );
    expect(
      within(pan).getByText("Only JPEG, PNG, WebP or PDF files"),
    ).toBeTruthy();
    const big = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    await user.upload(screen.getByLabelText("Upload PAN card"), big);
    expect(within(pan).getByText("The file is larger than 5 MB")).toBeTruthy();
    expect(onboardingApi.uploadDocument).not.toHaveBeenCalled();

    const doc = {
      _id: "d1",
      type: "pan_card",
      name: "pan.png",
      mimeType: "image/png",
      status: "pending",
      uploadedAt: "2026-11-12T00:00:00.000Z",
    };
    onboardingApi.uploadDocument.mockResolvedValue({ documents: [doc] });
    const file = new File(["png"], "pan.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Upload PAN card"), file);
    expect(onboardingApi.uploadDocument).toHaveBeenCalledWith("pan_card", file);
    expect(await within(pan).findByText("Uploaded")).toBeTruthy();
    expect(within(pan).getByText("pan.png")).toBeTruthy();

    onboardingApi.documentFile.mockResolvedValue(
      new Blob(["png"], { type: "image/png" }),
    );
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    URL.createObjectURL = vi.fn(() => "blob:doc");
    URL.revokeObjectURL = vi.fn();
    await user.click(
      within(pan).getByRole("button", { name: "View PAN card" }),
    );
    expect(onboardingApi.documentFile).toHaveBeenCalledWith("d1");
    expect(open).toHaveBeenCalledWith("blob:doc", "_blank", "noopener");

    onboardingApi.deleteDocument.mockResolvedValue({ documents: [] });
    await user.click(
      within(pan).getByRole("button", { name: "Remove PAN card" }),
    );
    expect(onboardingApi.deleteDocument).toHaveBeenCalledWith("d1");
    expect(await within(pan).findByText("Required")).toBeTruthy();
  });

  it("resumes where the owner left off — but never past a step still incomplete", async () => {
    onboardingApi.get.mockResolvedValue(
      view({
        business: businessDone,
        owner: ownerDone,
        missing: ["document:pan_card", "document:aadhaar_card"],
      }),
    );
    localStorage.setItem(STEP_KEY, "4"); // was on Review, but documents are still missing
    const first = render();
    await screen.findByTestId("doc-pan_card");
    expect(currentStep()).toContain("Documents");
    first.unmount();

    onboardingApi.get.mockResolvedValue(
      view({
        business: businessDone,
        missing: ["owner", "document:pan_card", "document:aadhaar_card"],
      }),
    );
    localStorage.removeItem(STEP_KEY);
    render();
    await screen.findByLabelText("Owner name");
    expect(currentStep()).toContain("Owner");
  });

  it("Review: submitting with a step missing lists what's missing (server 422) and stays", async () => {
    onboardingApi.get.mockResolvedValue(
      view({ business: businessDone, owner: ownerDone, missing: [] }),
    );
    onboardingApi.submit.mockRejectedValue(
      apiError(422, "ONBOARDING_INCOMPLETE", "Missing", {
        missing: ["document:aadhaar_card"],
      }),
    );
    const user = userEvent.setup();
    render();
    await user.click(
      await screen.findByRole("button", { name: "Submit for review" }),
    );
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Still missing");
    expect(alert.textContent).toContain("Aadhaar card upload");
    expect(screen.queryByTestId("landed")).toBeNull();
  });

  it("Review: shows what's missing up front and lets you jump back to fix it", async () => {
    onboardingApi.get.mockResolvedValue(
      view({ business: businessDone, missing: ["owner"] }),
    );
    localStorage.setItem(STEP_KEY, "4");
    const user = userEvent.setup();
    render();
    await screen.findByLabelText("Owner name"); // resumed at the first incomplete step
    await user.click(screen.getByRole("button", { name: /Review & submit/ }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Owner details",
    );
    await user.click(screen.getAllByRole("button", { name: "Edit" })[1]);
    expect(await screen.findByLabelText("Owner name")).toBeTruthy();
  });

  it("Review: a complete application is submitted, the session re-read, and the owner sent to the status screen", async () => {
    onboardingApi.get.mockResolvedValue(
      view({ business: businessDone, owner: ownerDone, missing: [] }),
    );
    onboardingApi.submit.mockResolvedValue(
      view({
        business: businessDone,
        owner: ownerDone,
        missing: [],
        submittedAt: "2026-11-12T10:00:00.000Z",
      }),
    );
    localStorage.setItem(STEP_KEY, "4");
    const reload = vi.fn().mockResolvedValue({});
    const user = userEvent.setup();
    render({ reload });
    expect(await screen.findByText("******234F")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Submit for review" }));
    await waitFor(() =>
      expect(screen.getByTestId("landed").textContent).toBe("/status"),
    );
    expect(onboardingApi.submit).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalled();
    expect(localStorage.getItem(STEP_KEY)).toBeNull();
  });

  it("a rejected application shows Yulo's note and offers to resubmit", async () => {
    onboardingApi.get.mockResolvedValue(
      view({
        status: "rejected",
        rejectionReason: "PAN photo is blurred",
        business: businessDone,
        owner: ownerDone,
        missing: [],
      }),
    );
    render();
    expect((await screen.findByRole("alert")).textContent).toContain(
      "PAN photo is blurred",
    );
    expect(
      await screen.findByRole("button", { name: "Resubmit for review" }),
    ).toBeTruthy();
  });

  it("loading failed: an error with a retry", async () => {
    onboardingApi.get
      .mockRejectedValueOnce(apiError(503, "X"))
      .mockResolvedValue(view());
    const user = userEvent.setup();
    render();
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("Business name")).toBeTruthy();
  });
});
