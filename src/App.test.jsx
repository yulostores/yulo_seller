import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// Every API answers with a never-settling promise: the screens stay in their loading state, which
// is enough to tell which screen a route mounted.
vi.mock("@/api/seller.api", () => {
  const pending = () => new Promise(() => {});
  const api = new Proxy({}, { get: () => pending });
  return {
    onboardingApi: api,
    accountApi: api,
    teamApi: api,
    categoriesApi: api,
    plansApi: api,
    redeemApi: api,
    reportsApi: api,
    offersApi: api,
    smsApi: api,
  };
});

import { SellerAuthContext } from "@/context/SellerAuthContext";
import { authValue, makeSession, ROUTER_FUTURE } from "@/test/sessions";
import App from "./App";

function renderAt(path, session) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <SellerAuthContext.Provider value={authValue(session)}>
        <MemoryRouter initialEntries={[path]} future={ROUTER_FUTURE}>
          <App />
        </MemoryRouter>
      </SellerAuthContext.Provider>
    </QueryClientProvider>,
  );
}

const heading = () =>
  screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent);

// Each built screen is wired to its route (not a placeholder) — a route left pointing at the
// placeholder fails here.
describe("App routes", () => {
  const owner = makeSession({ role: "owner" });
  const pending = makeSession({ role: "owner", status: "pending" });
  const cases = [
    ["/plans", owner, "Plans", "Choose a plan"],
    ["/dashboard", owner, "Dashboard", "Recent coupons"],
    ["/reports", makeSession({ role: "manager" }), "Reports", "Download CSV"],
    ["/offers", owner, "Offers", "New offer"],
    ["/reminders", owner, "Reminder SMS", null],
    [
      "/redeem",
      makeSession({ role: "employee" }),
      "Redeem Coupon",
      "Today's redemptions",
    ],
    ["/redeem", owner, "Redeem Coupon", null],
    ["/profile", owner, "Profile", null],
    ["/agreement", owner, "Partner agreement", null],
    ["/agreement", pending, "Partner agreement", null],
    ["/onboarding", pending, null, "Loading your application…"],
    ["/account", makeSession({ role: "employee" }), null, "My account"],
  ];
  for (const [path, session, h1, text] of cases) {
    it(`${path} (${session.user.role}/${session.seller.status})`, async () => {
      renderAt(path, session);
      // Most screens are lazy-loaded: wait for the screen itself, not the loading fallback.
      if (h1) await waitFor(() => expect(heading()).toContain(h1));
      if (text)
        await waitFor(() =>
          expect(screen.getAllByText(text).length).toBeGreaterThan(0),
        );
      expect(screen.queryByText("This screen is on its way.")).toBeNull();
    });
  }
});
