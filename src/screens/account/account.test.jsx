import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/api/seller.api", () => ({
  onboardingApi: { status: vi.fn() },
  accountApi: {
    profile: vi.fn(),
    updateProfile: vi.fn(),
    agreement: vi.fn(),
    acceptAgreement: vi.fn(),
  },
  teamApi: { list: vi.fn(), add: vi.fn(), update: vi.fn(), remove: vi.fn() },
  categoriesApi: { list: vi.fn() },
}));

import { accountApi, onboardingApi, teamApi } from "@/api/seller.api";
import { apiError, renderWith } from "@/test/renderWith";
import { makeSession } from "@/test/sessions";
import StatusPage from "@/screens/shared/StatusPage";
import AgreementPage from "./AgreementPage";
import { BusinessProfile } from "./BusinessProfile";
import { TeamPanel } from "./TeamPanel";

afterEach(() => vi.clearAllMocks());

// ── Status ────────────────────────────────────────────────────────────────────

describe("Status screen", () => {
  const show = (
    status,
    { role = "owner", submittedAt = null, reason = null } = {},
  ) => {
    onboardingApi.status.mockResolvedValue({
      status,
      submittedAt,
      reviewedAt: null,
      rejectionReason: reason,
    });
    return renderWith(<StatusPage />, {
      session: makeSession({ role, status }),
      path: "/status",
    });
  };

  it("pending, not sent yet: finish the application", async () => {
    show("pending");
    expect(await screen.findByText("Finish your application")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Continue application" })
        .getAttribute("href"),
    ).toBe("/onboarding");
  });

  it("pending and sent: under review, with the date", async () => {
    show("pending", { submittedAt: "2026-11-10T06:00:00.000Z" });
    expect(
      await screen.findByText("Your business is under review"),
    ).toBeTruthy();
    expect(screen.getByText(/Sent on 10 Nov 2026/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "View or edit application" }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Partner agreement" })
        .getAttribute("href"),
    ).toBe("/agreement");
  });

  it("rejected: Yulo's reason and Edit and resubmit", async () => {
    show("rejected", {
      reason: "PAN photo is blurred",
      submittedAt: "2026-11-10T06:00:00.000Z",
    });
    expect(
      await screen.findByText("Yulo's note: PAN photo is blurred"),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Edit and resubmit" })
        .getAttribute("href"),
    ).toBe("/onboarding");
  });

  it("suspended: contact Yulo, no application or agreement links", async () => {
    show("suspended", { role: "manager" });
    expect(await screen.findByText("This account is suspended")).toBeTruthy();
    expect(screen.getByText(/contact Yulo support/)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("only the owner gets the application link", async () => {
    show("pending", {
      role: "manager",
      submittedAt: "2026-11-10T06:00:00.000Z",
    });
    await screen.findByText("Your business is under review");
    expect(screen.queryByRole("link", { name: /application/ })).toBeNull();
  });

  it("Sign out", async () => {
    const logout = vi.fn();
    onboardingApi.status.mockResolvedValue({
      status: "pending",
      submittedAt: null,
    });
    renderWith(<StatusPage />, {
      session: makeSession({ status: "pending" }),
      path: "/status",
      auth: { logout },
    });
    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: /Sign out/ }));
    expect(logout).toHaveBeenCalled();
  });
});

// ── Agreement ─────────────────────────────────────────────────────────────────

describe("Agreement", () => {
  const agreement = (over = {}) => ({
    published: true,
    version: 2,
    text: "1. Coupons are honoured as offered.\n2. …",
    acceptance: null,
    upToDate: false,
    ...over,
  });

  it("not published yet", async () => {
    accountApi.agreement.mockResolvedValue({
      published: false,
      version: 0,
      text: "",
      acceptance: null,
      upToDate: false,
    });
    renderWith(<AgreementPage />, {
      session: makeSession(),
      path: "/agreement",
    });
    expect(
      await screen.findByText(/hasn't published the partner agreement yet/),
    ).toBeTruthy();
  });

  it("the owner reads, ticks and accepts; the acceptance shows with its date", async () => {
    accountApi.agreement.mockResolvedValue(agreement());
    accountApi.acceptAgreement.mockResolvedValue(
      agreement({
        upToDate: true,
        acceptance: {
          version: 2,
          acceptedAt: "2026-11-12T06:00:00.000Z",
          acceptedByName: "Asha Rao",
        },
      }),
    );
    const user = userEvent.setup();
    renderWith(<AgreementPage />, {
      session: makeSession({ role: "owner" }),
      path: "/agreement",
    });
    expect((await screen.findByTestId("agreement-text")).textContent).toContain(
      "Coupons are honoured",
    );
    expect(screen.getByText("Version 2")).toBeTruthy();
    const accept = screen.getByRole("button", { name: "Accept agreement" });
    expect(accept.disabled).toBe(true);
    await user.click(screen.getByRole("checkbox"));
    await user.click(accept);
    expect(accountApi.acceptAgreement).toHaveBeenCalledWith(2);
    expect(
      await screen.findByText(/Version 2 accepted on 12 Nov 2026 by Asha Rao/),
    ).toBeTruthy();
    expect(screen.getByText("Accepted")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Accept agreement" }),
    ).toBeNull();
  });

  it("a new version since the last acceptance: shown as not accepted, the old acceptance kept", async () => {
    accountApi.agreement.mockResolvedValue(
      agreement({
        acceptance: {
          version: 1,
          acceptedAt: "2026-10-01T06:00:00.000Z",
          acceptedByName: "Asha Rao",
        },
      }),
    );
    renderWith(<AgreementPage />, {
      session: makeSession({ role: "owner" }),
      path: "/agreement",
    });
    expect(
      await screen.findByText("New version — not accepted yet"),
    ).toBeTruthy();
    expect(screen.getByText(/Version 1 accepted on 1 Oct 2026/)).toBeTruthy();
  });

  it("the agreement changed while reading: reloaded, asked to read again", async () => {
    accountApi.agreement
      .mockResolvedValueOnce(agreement())
      .mockResolvedValue(agreement({ version: 3, text: "Version three text" }));
    accountApi.acceptAgreement.mockRejectedValue(
      apiError(409, "AGREEMENT_CHANGED"),
    );
    const user = userEvent.setup();
    renderWith(<AgreementPage />, {
      session: makeSession({ role: "owner" }),
      path: "/agreement",
    });
    await user.click(await screen.findByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Accept agreement" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "just updated",
    );
    expect(await screen.findByText("Version three text")).toBeTruthy();
    expect(screen.getByRole("checkbox").checked).toBe(false);
  });

  it("a manager reads it but cannot accept", async () => {
    accountApi.agreement.mockResolvedValue(agreement());
    renderWith(<AgreementPage />, {
      session: makeSession({ role: "manager" }),
      path: "/agreement",
    });
    expect(
      await screen.findByText(
        "The owner of the business accepts the agreement.",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Accept agreement" }),
    ).toBeNull();
  });
});

// ── Profile ───────────────────────────────────────────────────────────────────

const PROFILE = {
  _id: "s1",
  status: "active",
  businessName: "Glow Salon",
  category: { _id: "c", key: "salon", name: "Salon" },
  gstNumber: "29ABCDE1234F1Z5",
  establishedOn: "2020-01-01T00:00:00.000Z",
  address: {
    line1: "12 MG Road",
    line2: null,
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
  },
  location: { lat: 12.97, lng: 77.59 },
  businessPhone: "9811111111",
  owner: {
    name: "Asha Rao",
    panMasked: "******234F",
    aadhaarMasked: "XXXX XXXX 2346",
  },
  approvedAt: "2026-11-05T00:00:00.000Z",
  currentPlan: { plan: { key: "basic", name: "Basic" } },
  agreement: { upToDate: true },
  editableFields: ["businessPhone", "address", "location"],
};

describe("Profile — business", () => {
  it("business details read-only, identity masked; the owner edits the contact details", async () => {
    accountApi.profile.mockResolvedValue(PROFILE);
    accountApi.updateProfile.mockResolvedValue({
      ...PROFILE,
      businessPhone: "9844444444",
    });
    const user = userEvent.setup();
    const { container } = renderWith(<BusinessProfile />, {
      session: makeSession({ role: "owner" }),
      path: "/profile",
    });
    expect(await screen.findByText("******234F")).toBeTruthy();
    expect(screen.getByText("XXXX XXXX 2346")).toBeTruthy();
    expect(container.innerHTML).not.toMatch(/ABCDE1234F(?!1Z5)/); // only inside the GSTIN
    expect(screen.queryByLabelText("Business name")).toBeNull(); // not an input

    await user.clear(screen.getByLabelText("Shop phone"));
    await user.type(screen.getByLabelText("Shop phone"), "123");
    await user.click(
      screen.getByRole("button", { name: "Save contact details" }),
    );
    expect(
      screen.getByText("Enter a valid 10-digit mobile number"),
    ).toBeTruthy();
    expect(accountApi.updateProfile).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Shop phone"));
    await user.type(screen.getByLabelText("Shop phone"), "98444 44444");
    await user.click(
      screen.getByRole("button", { name: "Save contact details" }),
    );
    expect(accountApi.updateProfile).toHaveBeenCalledWith({
      businessPhone: "9844444444",
      address: {
        line1: "12 MG Road",
        line2: null,
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
      },
    });
    expect((await screen.findByRole("status")).textContent).toContain(
      "Contact details saved",
    );
  });

  it("a manager sees the same details but cannot edit them", async () => {
    accountApi.profile.mockResolvedValue(PROFILE);
    renderWith(<BusinessProfile />, {
      session: makeSession({ role: "manager" }),
      path: "/profile",
    });
    expect(
      await screen.findByText("Only the owner can change these."),
    ).toBeTruthy();
    expect(screen.getByLabelText("Shop phone").matches(":disabled")).toBe(true); // via the disabled fieldset
    expect(
      screen.queryByRole("button", { name: "Save contact details" }),
    ).toBeNull();
  });
});

// ── Team ──────────────────────────────────────────────────────────────────────

const member = (over) => ({
  _id: over.phone,
  dateOfBirth: null,
  gender: null,
  experienceYears: null,
  isActive: true,
  lastLoginAt: null,
  isYou: false,
  canManage: true,
  ...over,
});

const OWNER_VIEW = {
  manageableRoles: ["owner", "manager", "employee"],
  members: [
    member({
      name: "Asha Rao",
      phone: "9822222221",
      role: "owner",
      isYou: true,
      canManage: false,
    }),
    member({ name: "Meera Nair", phone: "9833333331", role: "manager" }),
    member({ name: "Ravi Kumar", phone: "9700000002", role: "employee" }),
  ],
};
const MANAGER_VIEW = {
  manageableRoles: ["employee"],
  members: [
    member({
      name: "Asha Rao",
      phone: "9822222221",
      role: "owner",
      canManage: false,
    }),
    member({
      name: "Meera Nair",
      phone: "9833333331",
      role: "manager",
      isYou: true,
      canManage: false,
    }),
    member({ name: "Ravi Kumar", phone: "9700000002", role: "employee" }),
  ],
};

describe("Profile — team", () => {
  it("owner: everyone listed; can't change themselves; can change others' roles", async () => {
    teamApi.list.mockResolvedValue(OWNER_VIEW);
    teamApi.update.mockResolvedValue({});
    const user = userEvent.setup();
    renderWith(<TeamPanel />, {
      session: makeSession({ role: "owner" }),
      path: "/profile",
    });
    const owner = await screen.findByTestId("member-9822222221");
    expect(within(owner).getByText("(you)")).toBeTruthy();
    expect(within(owner).queryByRole("combobox")).toBeNull();
    expect(
      within(owner).queryByRole("button", { name: "Deactivate" }),
    ).toBeNull();

    const roleSelect = screen.getByLabelText("Role of Ravi Kumar");
    expect([...roleSelect.options].map((o) => o.value)).toEqual([
      "employee",
      "owner",
      "manager",
    ]);
    await user.selectOptions(roleSelect, "manager");
    expect(teamApi.update).toHaveBeenCalledWith("9700000002", {
      role: "manager",
    });
    await waitFor(() => expect(teamApi.list).toHaveBeenCalledTimes(2)); // refreshed
  });

  it("owner adds a person: checked locally, sent, confirmed; a number already on the team is flagged", async () => {
    teamApi.list.mockResolvedValue(OWNER_VIEW);
    const user = userEvent.setup();
    renderWith(<TeamPanel />, {
      session: makeSession({ role: "owner" }),
      path: "/profile",
    });
    await screen.findByText("Add a person");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("Enter the name")).toBeTruthy();
    expect(teamApi.add).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Name"), "Sana Khan");
    await user.type(screen.getByLabelText("Mobile"), "9700000003");
    await user.selectOptions(screen.getByLabelText("Role"), "manager");
    await user.type(
      screen.getByLabelText("Date of birth (optional)"),
      "1995-02-02",
    );
    await user.selectOptions(
      screen.getByLabelText("Gender (optional)"),
      "female",
    );
    await user.type(screen.getByLabelText("Experience, years (optional)"), "4");
    teamApi.add.mockResolvedValueOnce({
      name: "Sana Khan",
      phone: "9700000003",
    });
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(teamApi.add).toHaveBeenCalledWith({
      name: "Sana Khan",
      phone: "9700000003",
      role: "manager",
      dateOfBirth: "1995-02-02",
      gender: "female",
      experienceYears: 4,
    });
    expect((await screen.findByRole("status")).textContent).toContain(
      "Sana Khan can now sign in with +91 9700000003",
    );

    teamApi.add.mockRejectedValueOnce(apiError(409, "DUPLICATE_PHONE"));
    await user.type(screen.getByLabelText("Name"), "Ravi Again");
    await user.type(screen.getByLabelText("Mobile"), "9700000002");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(
      await screen.findByText("Someone on your team already uses this number"),
    ).toBeTruthy();
  });

  it("deactivate asks first, then removes; cancel does nothing", async () => {
    teamApi.list.mockResolvedValue(OWNER_VIEW);
    teamApi.remove.mockResolvedValue({});
    const user = userEvent.setup();
    renderWith(<TeamPanel />, {
      session: makeSession({ role: "owner" }),
      path: "/profile",
    });
    const ravi = await screen.findByTestId("member-9700000002");
    await user.click(within(ravi).getByRole("button", { name: "Deactivate" }));
    await user.click(within(ravi).getByRole("button", { name: "Cancel" }));
    expect(teamApi.remove).not.toHaveBeenCalled();
    await user.click(within(ravi).getByRole("button", { name: "Deactivate" }));
    expect(within(ravi).getByRole("alertdialog").textContent).toContain(
      "signed out",
    );
    await user.click(
      within(ravi).getByRole("button", { name: "Yes, deactivate" }),
    );
    expect(teamApi.remove).toHaveBeenCalledWith("9700000002");
  });

  it("a refused change shows the server's reason (e.g. the last owner)", async () => {
    teamApi.list.mockResolvedValue(OWNER_VIEW);
    teamApi.update.mockRejectedValue(
      apiError(
        409,
        "LAST_OWNER",
        "The business must keep at least one active owner",
      ),
    );
    const user = userEvent.setup();
    renderWith(<TeamPanel />, {
      session: makeSession({ role: "owner" }),
      path: "/profile",
    });
    await user.selectOptions(
      await screen.findByLabelText("Role of Meera Nair"),
      "employee",
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "at least one active owner",
    );
  });

  it("manager: sees employees only, and can only add employees", async () => {
    teamApi.list.mockResolvedValue(MANAGER_VIEW);
    renderWith(<TeamPanel />, {
      session: makeSession({ role: "manager" }),
      path: "/profile",
    });
    expect(await screen.findByText("Employees")).toBeTruthy();
    expect(screen.getByTestId("member-9700000002")).toBeTruthy();
    expect(screen.queryByTestId("member-9822222221")).toBeNull();
    expect(screen.queryByTestId("member-9833333331")).toBeNull();
    expect(
      [...screen.getByLabelText("Role").options].map((o) => o.value),
    ).toEqual(["employee"]);
    expect(
      [...screen.getByLabelText("Role of Ravi Kumar").options].map(
        (o) => o.value,
      ),
    ).toEqual(["employee"]);
  });

  it("no team yet; loading failed with a retry", async () => {
    teamApi.list
      .mockRejectedValueOnce(apiError(503, "X"))
      .mockResolvedValue({ manageableRoles: ["employee"], members: [] });
    const user = userEvent.setup();
    renderWith(<TeamPanel />, {
      session: makeSession({ role: "manager" }),
      path: "/profile",
    });
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No employees yet.")).toBeTruthy();
  });
});
