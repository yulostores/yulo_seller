import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/api/auth.api", () => ({
  authApi: {
    categories: vi.fn(),
    sendOtp: vi.fn(),
    verifyOtp: vi.fn(),
    signup: vi.fn(),
    selectAccount: vi.fn(),
    passwordLogin: vi.fn(),
    me: vi.fn(),
    logout: vi.fn(),
  },
}));

import { authApi } from "@/api/auth.api";
import { setAccessToken } from "@/api/client";
import { renderApp, sessionResponse } from "@/test/renderApp";

// A sign-in call that answers `response`; GET /me then describes the same login, as the real
// server would.
const signInWith = (fn, response) => {
  fn.mockResolvedValue(response);
  authApi.me.mockResolvedValue({ ...response, hasPassword: false });
};
import { validateSignup } from "./SignupPage";

const apiError = (status, code, message, details) =>
  Object.assign(new Error(message), {
    status,
    code,
    details,
    isApiError: true,
  });

beforeEach(() => {
  localStorage.clear();
  setAccessToken(null);
  authApi.sendOtp.mockResolvedValue({ phone: "9822222221", devOtp: "123456" });
  authApi.verifyOtp.mockResolvedValue({
    needsSignup: true,
    phone: "9822222221",
    signupToken: "proof-1",
  });
  authApi.categories.mockResolvedValue([
    { _id: "c-salon", key: "salon", name: "Salon", icon: null },
    { _id: "c-spa", key: "spa", name: "Spa", icon: null },
  ]);
  authApi.me.mockResolvedValue({ ...sessionResponse(), hasPassword: false });
});
afterEach(() => vi.clearAllMocks());

async function verifyPhone(user) {
  await user.type(screen.getByLabelText("Mobile number"), "9822222221");
  await user.click(screen.getByRole("button", { name: "Send code" }));
  await user.type(await screen.findByLabelText("Code"), "123456");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByLabelText("Business name");
}

describe("Signup — phone → OTP → business details", () => {
  it("creates the business with trimmed details and lands on the status screen (pending review)", async () => {
    signInWith(
      authApi.signup,
      sessionResponse({ role: "owner", status: "pending" }),
    );
    const user = userEvent.setup();
    renderApp("/signup");
    expect(screen.getByText("Register your business")).toBeTruthy();
    await verifyPhone(user);

    await screen.findByRole("option", { name: "Spa" });
    await user.type(screen.getByLabelText("Business name"), "  Glow Salon  ");
    await user.selectOptions(screen.getByLabelText("Category"), "c-salon");
    await user.type(screen.getByLabelText("Your name"), " Asha Rao ");
    await user.click(
      screen.getByRole("button", { name: "Create my business" }),
    );

    expect(authApi.signup).toHaveBeenCalledWith({
      signupToken: "proof-1",
      businessName: "Glow Salon",
      categoryId: "c-salon",
      ownerName: "Asha Rao",
    });
    expect((await screen.findByTestId("landed")).textContent).toBe("/status");
  });

  it("checks every field before sending", async () => {
    const user = userEvent.setup();
    renderApp("/signup");
    await verifyPhone(user);
    await user.click(
      screen.getByRole("button", { name: "Create my business" }),
    );
    expect(screen.getByText("Enter the business name")).toBeTruthy();
    expect(screen.getByText("Choose what kind of business it is")).toBeTruthy();
    expect(screen.getByText("Enter your name")).toBeTruthy();
    expect(authApi.signup).not.toHaveBeenCalled();
  });

  it("shows the server's field errors next to the field", async () => {
    authApi.signup.mockRejectedValue(
      apiError(400, "VALIDATION_ERROR", "Invalid input", {
        fieldErrors: { categoryId: ["Unknown category"] },
      }),
    );
    const user = userEvent.setup();
    renderApp("/signup");
    await verifyPhone(user);
    await screen.findByRole("option", { name: "Salon" });
    await user.type(screen.getByLabelText("Business name"), "Glow Salon");
    await user.selectOptions(screen.getByLabelText("Category"), "c-salon");
    await user.type(screen.getByLabelText("Your name"), "Asha Rao");
    await user.click(
      screen.getByRole("button", { name: "Create my business" }),
    );
    expect(await screen.findByText("Unknown category")).toBeTruthy();
  });

  it("an expired proof asks to start again; a number already registered says to sign in", async () => {
    authApi.signup.mockRejectedValue(
      apiError(401, "INVALID_TOKEN", "Invalid signup proof"),
    );
    const user = userEvent.setup();
    renderApp("/signup");
    await verifyPhone(user);
    await screen.findByRole("option", { name: "Salon" });
    await user.type(screen.getByLabelText("Business name"), "Glow Salon");
    await user.selectOptions(screen.getByLabelText("Category"), "c-salon");
    await user.type(screen.getByLabelText("Your name"), "Asha Rao");
    await user.click(
      screen.getByRole("button", { name: "Create my business" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "verification has expired",
    );

    authApi.signup.mockRejectedValue(
      apiError(409, "PHONE_ALREADY_REGISTERED", "x"),
    );
    await user.click(
      screen.getByRole("button", { name: "Create my business" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "already owns a business",
    );
  });

  it("an already-registered number signs straight in instead", async () => {
    signInWith(authApi.verifyOtp, sessionResponse({ role: "owner" }));
    const user = userEvent.setup();
    renderApp("/signup");
    await user.type(screen.getByLabelText("Mobile number"), "9822222221");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    await user.type(await screen.findByLabelText("Code"), "123456");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect((await screen.findByTestId("landed")).textContent).toBe(
      "/dashboard",
    );
  });

  it("categories that fail to load can be retried", async () => {
    authApi.categories.mockRejectedValueOnce(apiError(503, "X", "down"));
    const user = userEvent.setup();
    renderApp("/signup");
    await verifyPhone(user);
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("option", { name: "Spa" })).toBeTruthy();
  });

  it("validateSignup limits", () => {
    expect(
      validateSignup({ businessName: "G", categoryId: "", ownerName: "" }),
    ).toEqual({
      businessName: "Enter the business name",
      categoryId: "Choose what kind of business it is",
      ownerName: "Enter your name",
    });
    expect(
      validateSignup({
        businessName: "x".repeat(121),
        categoryId: "c",
        ownerName: "y".repeat(101),
      }),
    ).toEqual({
      businessName: "At most 120 characters",
      ownerName: "At most 100 characters",
    });
    expect(
      validateSignup({
        businessName: "Glow",
        categoryId: "c",
        ownerName: "Asha",
      }),
    ).toEqual({});
  });
});
