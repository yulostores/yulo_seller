import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { SellerAuthContext } from "@/context/SellerAuthContext";
import { AppShell } from "./AppShell";
import AccountPage from "@/screens/shared/AccountPage";
import { authValue, makeSession, ROUTER_FUTURE } from "@/test/sessions";

function renderShell(session, extra = {}) {
  const value = authValue(session, extra);
  render(
    <SellerAuthContext.Provider value={value}>
      <MemoryRouter initialEntries={["/redeem"]} future={ROUTER_FUTURE}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/redeem" element={<p>redeem screen</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </SellerAuthContext.Provider>,
  );
  return value;
}
const linksIn = (label) =>
  within(screen.getByRole("navigation", { name: label }))
    .getAllByRole("link")
    .map((a) => a.textContent);

describe("AppShell", () => {
  it("owner: the full sidebar and bottom bar, business and person named, Owner badge", () => {
    renderShell(makeSession({ role: "owner" }));
    const full = [
      "Dashboard",
      "Redeem Coupon",
      "Reports",
      "Offers",
      "Plans",
      "Reminder SMS",
      "Agreement",
      "Profile",
    ];
    expect(linksIn("Main navigation")).toEqual(full);
    expect(linksIn("Main navigation (mobile)")).toEqual(full);
    expect(screen.getByTestId("business-name").textContent).toBe("Glow Salon");
    expect(screen.getByText("Asha Rao")).toBeTruthy();
    expect(screen.getByText("Owner")).toBeTruthy();
    expect(screen.getByText("redeem screen")).toBeTruthy();
  });

  it("manager: the same sidebar, Manager badge", () => {
    renderShell(makeSession({ role: "manager", name: "Meera Nair" }));
    expect(linksIn("Main navigation")).toHaveLength(8);
    expect(screen.getByText("Manager")).toBeTruthy();
  });

  it("employee: only Redeem Coupon and My account", () => {
    renderShell(makeSession({ role: "employee", name: "Ravi Kumar" }));
    expect(linksIn("Main navigation")).toEqual(["Redeem Coupon", "My account"]);
    expect(linksIn("Main navigation (mobile)")).toEqual([
      "Redeem Coupon",
      "My account",
    ]);
    expect(screen.getByText("Employee")).toBeTruthy();
  });

  it("the active screen is marked", () => {
    renderShell(makeSession({ role: "owner" }));
    const active = within(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).getByRole("link", { name: "Redeem Coupon" });
    expect(active.getAttribute("aria-current")).toBe("page");
  });

  it("Sign out calls logout", async () => {
    const logout = vi.fn();
    renderShell(makeSession({ role: "employee" }), { logout });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /Sign out/ }));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});

describe("AccountPage", () => {
  it("shows the person's own details and signs out", async () => {
    const logout = vi.fn();
    render(
      <SellerAuthContext.Provider
        value={authValue(
          makeSession({ role: "employee", name: "Ravi Kumar" }),
          { logout },
        )}
      >
        <AccountPage />
      </SellerAuthContext.Provider>,
    );
    expect(screen.getByText("Ravi Kumar")).toBeTruthy();
    expect(screen.getByText("+91 9822222221")).toBeTruthy();
    expect(screen.getByText("Employee")).toBeTruthy();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Sign out" }));
    expect(logout).toHaveBeenCalled();
  });
});
