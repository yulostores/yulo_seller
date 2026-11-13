import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { SellerAuthContext } from "@/context/SellerAuthContext";
import {
  accessLevel,
  allowedPaths,
  canVisit,
  homeFor,
  navFor,
  NAV_ITEMS,
  PATHS,
} from "./access";
import { RequireAccess } from "./RequireAccess";
import {
  authValue,
  makeSession,
  ROLES,
  ROUTER_FUTURE,
  STATUSES,
} from "@/test/sessions";

const ALL_SCREENS = Object.values(PATHS);
const FULL_SIDEBAR = [
  "Dashboard",
  "Redeem Coupon",
  "Reports",
  "Offers",
  "Plans",
  "Reminder SMS",
  "Agreement",
  "Profile",
];

// The expected home and screens for every role × status (pending and rejected behave the same).
function expected(role, status) {
  if (status === "suspended")
    return { home: PATHS.status, screens: [PATHS.status] };
  if (status !== "active")
    return {
      home: PATHS.status,
      screens: [PATHS.status, PATHS.onboarding, PATHS.agreement],
    };
  if (role === "employee")
    return { home: PATHS.redeem, screens: [PATHS.redeem, PATHS.account] };
  return {
    home: PATHS.dashboard,
    screens: [
      PATHS.dashboard,
      PATHS.redeem,
      PATHS.reports,
      PATHS.offers,
      PATHS.plans,
      PATHS.reminders,
      PATHS.agreement,
      PATHS.profile,
      PATHS.account,
    ],
  };
}

describe("access rules — every role × seller status", () => {
  for (const role of ROLES) {
    for (const status of STATUSES) {
      it(`${role} / ${status}`, () => {
        const session = makeSession({ role, status });
        const want = expected(role, status);
        expect(homeFor(session)).toBe(want.home);
        expect([...allowedPaths(session)].sort()).toEqual(
          [...want.screens].sort(),
        );
        for (const path of ALL_SCREENS) {
          expect(canVisit(session, path), `${role}/${status} → ${path}`).toBe(
            want.screens.includes(path),
          );
        }
        // Sign-in screens are for signed-out visitors only.
        expect(canVisit(session, PATHS.login)).toBe(false);
      });
    }
  }

  it("signed out: only the sign-in screens; home is the login", () => {
    expect(accessLevel(null)).toBe("anonymous");
    expect(homeFor(null)).toBe(PATHS.login);
    expect(canVisit(null, PATHS.login)).toBe(true);
    expect(canVisit(null, PATHS.signup)).toBe(true);
    for (const path of ALL_SCREENS.filter(
      (p) => p !== PATHS.login && p !== PATHS.signup,
    ))
      expect(canVisit(null, path)).toBe(false);
  });

  it("sub-paths follow their screen, look-alike paths don't", () => {
    const owner = makeSession({ role: "owner" });
    expect(canVisit(owner, "/reports/coupons")).toBe(true);
    expect(canVisit(owner, "/reportsX")).toBe(false);
    expect(canVisit(makeSession({ role: "employee" }), "/redeem/history")).toBe(
      true,
    );
  });

  it("navigation: the full sidebar for owners and managers, Redeem + account for employees, none otherwise", () => {
    expect(navFor(makeSession({ role: "owner" })).map((n) => n.label)).toEqual(
      FULL_SIDEBAR,
    );
    expect(
      navFor(makeSession({ role: "manager" })).map((n) => n.label),
    ).toEqual(FULL_SIDEBAR);
    expect(
      navFor(makeSession({ role: "employee" })).map((n) => n.label),
    ).toEqual(["Redeem Coupon", "My account"]);
    expect(navFor(makeSession({ status: "pending" }))).toEqual([]);
    expect(navFor(null)).toEqual([]);
    expect(NAV_ITEMS).toHaveLength(8);
  });
});

// The guard component, rendered: a URL the session may not open redirects to its home.
function WhereAmI() {
  return <p data-testid="at">{useLocation().pathname}</p>;
}
function renderAt(path, session, state = "ready") {
  return render(
    <SellerAuthContext.Provider value={{ ...authValue(session), state }}>
      <MemoryRouter initialEntries={[path]} future={ROUTER_FUTURE}>
        <Routes>
          <Route element={<RequireAccess />}>
            {Object.values(PATHS).map((p) => (
              <Route key={p} path={p} element={<WhereAmI />} />
            ))}
          </Route>
        </Routes>
      </MemoryRouter>
    </SellerAuthContext.Provider>,
  );
}

describe("<RequireAccess> redirects", () => {
  const cases = [
    ["owner", "active", PATHS.plans, PATHS.plans],
    ["manager", "active", PATHS.reports, PATHS.reports],
    ["employee", "active", PATHS.dashboard, PATHS.redeem],
    ["employee", "active", PATHS.plans, PATHS.redeem],
    ["employee", "active", PATHS.account, PATHS.account],
    ["owner", "pending", PATHS.dashboard, PATHS.status],
    ["owner", "pending", PATHS.onboarding, PATHS.onboarding],
    ["owner", "rejected", PATHS.redeem, PATHS.status],
    ["manager", "suspended", PATHS.redeem, PATHS.status],
    ["owner", "suspended", PATHS.onboarding, PATHS.status],
    ["owner", "active", PATHS.login, PATHS.dashboard],
  ];
  for (const [role, status, from, to] of cases) {
    it(`${role}/${status}: ${from} → ${to}`, () => {
      renderAt(from, makeSession({ role, status }));
      expect(screen.getByTestId("at").textContent).toContain(to);
    });
  }

  it("signed out: a private screen sends you to the login", () => {
    renderAt(PATHS.dashboard, null);
    expect(screen.getByTestId("at").textContent).toContain(PATHS.login);
  });

  it("while a session is being restored: a spinner, no redirect", () => {
    renderAt(PATHS.dashboard, null, "loading");
    expect(screen.getByRole("status").textContent).toContain("Signing you in");
    expect(screen.queryByTestId("at")).toBeNull();
  });

  it("restore failed (offline): a retry button, no redirect", () => {
    renderAt(PATHS.dashboard, null, "error");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
