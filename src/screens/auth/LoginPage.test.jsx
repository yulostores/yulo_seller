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
import { getAccessToken, setAccessToken } from "@/api/client";
import { renderApp, sessionResponse } from "@/test/renderApp";

// A sign-in call that answers `response`; GET /me then describes the same login, as the real
// server would.
const signInWith = (fn, response) => {
  fn.mockResolvedValue(response);
  authApi.me.mockResolvedValue({ ...response, hasPassword: false });
};

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
  authApi.me.mockResolvedValue({ ...sessionResponse(), hasPassword: false });
  authApi.categories.mockResolvedValue([
    { _id: "c-salon", key: "salon", name: "Salon", icon: null },
  ]);
});
afterEach(() => vi.clearAllMocks());

async function enterPhoneAndCode(
  user,
  { phone = "+91 98222 22221", code = "123456" } = {},
) {
  await user.type(screen.getByLabelText("Mobile number"), phone);
  await user.click(screen.getByRole("button", { name: "Send code" }));
  await screen.findByLabelText("Code");
  await user.type(screen.getByLabelText("Code"), code);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("Login — phone → OTP", () => {
  it("refuses an invalid number without calling the server", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText("Mobile number"), "12345");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    expect(
      screen.getByText("Enter a valid 10-digit mobile number"),
    ).toBeTruthy();
    expect(authApi.sendOtp).not.toHaveBeenCalled();
  });

  it("sends the code to the normalised number, shows the development code, then signs an owner into the dashboard", async () => {
    signInWith(authApi.verifyOtp, sessionResponse({ role: "owner" }));
    const user = userEvent.setup();
    renderApp();
    await enterPhoneAndCode(user);
    expect(authApi.sendOtp).toHaveBeenCalledWith("9822222221");
    expect(authApi.verifyOtp).toHaveBeenCalledWith("9822222221", "123456");
    expect((await screen.findByTestId("landed")).textContent).toBe(
      "/dashboard",
    );
    expect(getAccessToken()).toBe("token-owner");
    expect(localStorage.getItem("yulo_seller_signed_in")).toBe("1");
  });

  it("the code screen shows where the code went, the development code, and a resend countdown", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText("Mobile number"), "9822222221");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByText("+91 9822222221")).toBeTruthy();
    expect(screen.getByText("Development code: 123456")).toBeTruthy();
    expect(screen.getByText(/Resend code in \d+s/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Change number" }));
    expect(screen.getByLabelText("Mobile number")).toBeTruthy();
  });

  it("an employee lands on Redeem; a pending business on the status screen", async () => {
    signInWith(authApi.verifyOtp, sessionResponse({ role: "employee" }));
    const user = userEvent.setup();
    const first = renderApp();
    await enterPhoneAndCode(user);
    expect((await screen.findByTestId("landed")).textContent).toBe("/redeem");
    first.unmount();

    localStorage.clear();
    signInWith(
      authApi.verifyOtp,
      sessionResponse({ role: "owner", status: "pending" }),
    );
    renderApp();
    await enterPhoneAndCode(user);
    expect((await screen.findByTestId("landed")).textContent).toBe("/status");
  });

  it("a wrong code shows the server's reason and stays on the code screen", async () => {
    authApi.verifyOtp.mockRejectedValue(
      apiError(400, "INVALID_OTP", "Invalid code"),
    );
    const user = userEvent.setup();
    renderApp();
    await enterPhoneAndCode(user, { code: "000000" });
    expect((await screen.findByRole("alert")).textContent).toContain(
      "That code is not right",
    );
    expect(screen.getByLabelText("Code")).toBeTruthy();
    expect(getAccessToken()).toBeNull();
  });

  it("a short code is refused locally", async () => {
    const user = userEvent.setup();
    renderApp();
    await enterPhoneAndCode(user, { code: "123" });
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Enter the 6-digit code",
    );
    expect(authApi.verifyOtp).not.toHaveBeenCalled();
  });

  it("a number with no business continues into sign-up with its proof", async () => {
    authApi.verifyOtp.mockResolvedValue({
      needsSignup: true,
      phone: "9822222221",
      signupToken: "proof-1",
    });
    const user = userEvent.setup();
    renderApp();
    await enterPhoneAndCode(user);
    expect(
      await screen.findByText("Mobile verified: +91 9822222221"),
    ).toBeTruthy();
    expect(screen.getByLabelText("Business name")).toBeTruthy();
  });

  it("a number with logins at two businesses picks one", async () => {
    authApi.verifyOtp.mockResolvedValue({
      needsAccountChoice: true,
      selectToken: "select-1",
      accounts: [
        {
          sellerUserId: "u1",
          sellerId: "s1",
          businessName: "Glow Salon",
          sellerStatus: "active",
          role: "manager",
        },
        {
          sellerUserId: "u2",
          sellerId: "s2",
          businessName: "Calm Spa",
          sellerStatus: "active",
          role: "employee",
        },
      ],
    });
    signInWith(
      authApi.selectAccount,
      sessionResponse({ role: "employee", business: "Calm Spa" }),
    );
    const user = userEvent.setup();
    renderApp();
    await enterPhoneAndCode(user);
    expect(await screen.findByText("Choose a business")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Calm Spa/ }));
    expect(authApi.selectAccount).toHaveBeenCalledWith("select-1", "u2");
    expect((await screen.findByTestId("landed")).textContent).toBe("/redeem");
  });

  it("a rate-limited send says to wait", async () => {
    authApi.sendOtp.mockRejectedValue(
      apiError(429, "RATE_LIMITED", "Too many"),
    );
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText("Mobile number"), "9822222221");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "wait a minute",
    );
  });

  it("owners can sign in with a password instead", async () => {
    signInWith(authApi.passwordLogin, sessionResponse({ role: "owner" }));
    const user = userEvent.setup();
    renderApp();
    await user.click(
      screen.getByRole("button", { name: "Owner? Sign in with a password" }),
    );
    await user.type(screen.getByLabelText("Mobile number"), "9822222221");
    await user.type(screen.getByLabelText("Password"), "Glow#2026salon");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(authApi.passwordLogin).toHaveBeenCalledWith(
      "9822222221",
      "Glow#2026salon",
    );
    expect((await screen.findByTestId("landed")).textContent).toBe(
      "/dashboard",
    );
  });
});
