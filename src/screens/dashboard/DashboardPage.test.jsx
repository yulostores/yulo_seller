import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/api/seller.api", () => ({
  reportsApi: { dashboard: vi.fn(), trends: vi.fn() },
}));

import { reportsApi } from "@/api/seller.api";
import { apiError, renderWith } from "@/test/renderWith";
import { makeSession } from "@/test/sessions";
import { DASHBOARD, series, TRENDS } from "@/test/fixtures";
import DashboardPage from "./DashboardPage";

const render = () =>
  renderWith(<DashboardPage />, { session: makeSession(), path: "/dashboard" });
afterEach(() => vi.clearAllMocks());

describe("Dashboard", () => {
  it("stat tiles carry the API's numbers", async () => {
    reportsApi.dashboard.mockResolvedValue(DASHBOARD);
    reportsApi.trends.mockResolvedValue(TRENDS);
    render();
    const tile = async (id) => (await screen.findByTestId(id)).textContent;
    expect(await tile("tile-issued")).toContain("60");
    expect(await tile("tile-pending")).toContain("190");
    expect(await tile("tile-redeemed")).toContain("24");
    expect(await tile("tile-expired")).toContain("4");
    expect(await tile("tile-rate")).toContain("40%");
  });

  // CF10 browser run: after buying Basic and then Plus the tile still said "Basic plan".
  it("plan tile names every active plan once more than one is bought", async () => {
    reportsApi.dashboard.mockResolvedValue({
      ...DASHBOARD,
      activePlans: [
        { key: "basic", name: "Basic" },
        { key: "plus", name: "Plus" },
      ],
    });
    reportsApi.trends.mockResolvedValue(TRENDS);
    render();
    expect((await screen.findByTestId("plan-tile")).textContent).toContain(
      "Basic + Plus plans",
    );
  });

  it("plan tile: name, status, given out / left, progress", async () => {
    reportsApi.dashboard.mockResolvedValue(DASHBOARD);
    reportsApi.trends.mockResolvedValue(TRENDS);
    render();
    const plan = await screen.findByTestId("plan-tile");
    expect(plan.textContent).toContain("Basic plan");
    expect(plan.textContent).toContain(
      "60 of 250 coupons given out · 190 left",
    );
    expect(
      within(plan).getByRole("progressbar").getAttribute("aria-valuenow"),
    ).toBe("24");
  });

  it("trend: asked for daily buckets; the numbers are in the accessible table", async () => {
    reportsApi.dashboard.mockResolvedValue(DASHBOARD);
    reportsApi.trends.mockResolvedValue(TRENDS);
    render();
    const table = await screen.findByRole("table", {
      name: "Coupons issued and redeemed",
    });
    expect(reportsApi.trends).toHaveBeenCalledWith({ interval: "day" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[2].textContent).toBe("3 Nov42");
  });

  it("recent coupons with issue and expiry dates", async () => {
    reportsApi.dashboard.mockResolvedValue(DASHBOARD);
    reportsApi.trends.mockResolvedValue(TRENDS);
    render();
    const table = await screen.findByRole("table", { name: "Recent coupons" });
    const [head, ...rows] = within(table).getAllByRole("row");
    expect(head.textContent).toBe("CustomerOfferIssuedExpiresStatus");
    expect(rows[0].textContent).toContain("Priya S.");
    expect(rows[0].textContent).toContain("1 Nov 2026");
    expect(rows[0].textContent).toContain("1 Dec 2026");
    expect(rows[1].textContent).toContain("Redeemed");
  });

  it("empty: no plan, no coupons, nothing in the trend", async () => {
    reportsApi.dashboard.mockResolvedValue({
      ...DASHBOARD,
      currentPlan: null,
      stock: { allocated: 0, issued: 0, pending: 0 },
      coupons: {
        issued: 0,
        active: 0,
        redeemed: 0,
        expired: 0,
        void: 0,
        redemptionRate: 0,
      },
      recentCoupons: [],
    });
    reportsApi.trends.mockResolvedValue({
      ...TRENDS,
      series: series(3).map((s) => ({ ...s, issued: 0, redeemed: 0 })),
    });
    render();
    expect((await screen.findByTestId("plan-tile")).textContent).toContain(
      "No plan yet",
    );
    expect(screen.getByText(/No coupons yet/)).toBeTruthy();
    expect(
      await screen.findByText("No coupons in this period yet."),
    ).toBeTruthy();
  });

  it("errors: shown with a retry that works", async () => {
    reportsApi.dashboard
      .mockRejectedValueOnce(apiError(503, "X"))
      .mockResolvedValue(DASHBOARD);
    reportsApi.trends.mockResolvedValue(TRENDS);
    render();
    const alerts = await screen.findAllByRole("alert");
    expect(alerts[0].textContent).toContain("server is having trouble");
    await userEvent
      .setup()
      .click(screen.getAllByRole("button", { name: "Try again" })[0]);
    expect(await screen.findByTestId("tile-issued")).toBeTruthy();
  });
});
