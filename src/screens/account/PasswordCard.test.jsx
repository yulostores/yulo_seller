import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/api/auth.api", () => ({ authApi: { setPassword: vi.fn() } }));
vi.mock("@/api/seller.api", () => ({
  accountApi: { profile: vi.fn(() => new Promise(() => {})) },
  teamApi: { list: vi.fn(() => new Promise(() => {})) },
}));

import { authApi } from "@/api/auth.api";
import { apiError, renderWith } from "@/test/renderWith";
import { makeSession } from "@/test/sessions";
import ProfilePage from "./ProfilePage";
import { PasswordCard, validatePassword } from "./PasswordCard";

afterEach(() => vi.clearAllMocks());

describe("Sign-in password", () => {
  it("owners only", () => {
    renderWith(<ProfilePage />, {
      session: makeSession({ role: "manager" }),
      path: "/profile",
    });
    expect(screen.queryByRole("form", { name: "Sign-in password" })).toBeNull();
  });

  it("first time: no current password asked; checked, then set and the session reloaded", async () => {
    authApi.setPassword.mockResolvedValue(null);
    const reload = vi.fn(async () => {});
    const user = userEvent.setup();
    renderWith(<PasswordCard />, {
      session: makeSession(),
      auth: { reload },
      path: "/profile",
    });
    expect(screen.queryByLabelText("Current password")).toBeNull();
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: "Set password" }));
    expect(screen.getByText("Use at least 8 characters")).toBeTruthy();
    await user.clear(screen.getByLabelText("Password"));
    await user.type(screen.getByLabelText("Password"), "Spa#2026x");
    await user.type(screen.getByLabelText("Type it again"), "Spa#2026y");
    await user.click(screen.getByRole("button", { name: "Set password" }));
    expect(screen.getByText("The two passwords don't match")).toBeTruthy();
    await user.clear(screen.getByLabelText("Type it again"));
    await user.type(screen.getByLabelText("Type it again"), "Spa#2026x");
    await user.click(screen.getByRole("button", { name: "Set password" }));
    expect(authApi.setPassword).toHaveBeenCalledWith("Spa#2026x", undefined);
    expect((await screen.findByRole("status")).textContent).toBe(
      "Password saved.",
    );
    expect(reload).toHaveBeenCalled();
  });

  it("changing it needs the current one; a wrong one is shown on that field", async () => {
    authApi.setPassword
      .mockRejectedValueOnce(apiError(401, "INVALID_CREDENTIALS"))
      .mockResolvedValue(null);
    const session = { ...makeSession(), hasPassword: true };
    const user = userEvent.setup();
    renderWith(<PasswordCard />, { session, path: "/profile" });
    await user.type(screen.getByLabelText("New password"), "NewPass#123");
    await user.type(screen.getByLabelText("Type it again"), "NewPass#123");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(screen.getByText("Enter your current password")).toBeTruthy();
    await user.type(screen.getByLabelText("Current password"), "wrong-one");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(
      await screen.findByText("That isn't your current password"),
    ).toBeTruthy();
    expect(authApi.setPassword).toHaveBeenLastCalledWith(
      "NewPass#123",
      "wrong-one",
    );
  });

  it("validatePassword", () => {
    expect(
      validatePassword(
        { current: "", next: "12345678", confirm: "12345678" },
        false,
      ),
    ).toEqual({});
  });
});
