import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/api/seller.api", () => ({
  reportsApi: {
    demographics: vi.fn(),
    trends: vi.fn(),
    coupons: vi.fn(),
    couponsCsv: vi.fn(),
  },
}));

import { reportsApi } from "@/api/seller.api";
import { apiError, renderWith } from "@/test/renderWith";
import { makeSession } from "@/test/sessions";
import { COUPONS_PAGE, DEMOGRAPHICS, series, TRENDS } from "@/test/fixtures";
import ReportsPage, { reportQuery } from "./ReportsPage";

const render = () =>
  renderWith(<ReportsPage />, {
    session: makeSession({ role: "manager" }),
    path: "/reports",
  });

beforeEach(() => {
  reportsApi.demographics.mockResolvedValue(DEMOGRAPHICS);
  reportsApi.trends.mockImplementation(async ({ interval }) => ({
    ...TRENDS,
    interval,
    series: series(3, interval),
  }));
  reportsApi.coupons.mockImplementation(async ({ page }) => COUPONS_PAGE(page));
});
afterEach(() => vi.clearAllMocks());

async function setFilters(user, { from, to, status }) {
  if (from) await user.type(screen.getByLabelText("From"), from);
  if (to) await user.type(screen.getByLabelText("To"), to);
  if (status) await user.selectOptions(screen.getByLabelText("Status"), status);
  await user.click(screen.getByRole("button", { name: "Apply" }));
}

describe("Reports", () => {
  it("first load: everything unfiltered, page 1", async () => {
    render();
    await screen.findByTestId("r-issued");
    expect(reportsApi.demographics).toHaveBeenCalledWith({});
    expect(reportsApi.trends).toHaveBeenCalledWith({ interval: "day" });
    expect(reportsApi.coupons).toHaveBeenCalledWith({ page: 1, limit: 25 });
  });

  it("filters change every query (and paging restarts at 1)", async () => {
    const user = userEvent.setup();
    render();
    await screen.findByTestId("r-issued");
    await user.click(await screen.findByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(reportsApi.coupons).toHaveBeenLastCalledWith({
        page: 2,
        limit: 25,
      }),
    );

    await setFilters(user, {
      from: "2026-10-01",
      to: "2026-10-31",
      status: "redeemed",
    });
    const q = { from: "2026-10-01", to: "2026-10-31", status: "redeemed" };
    await waitFor(() =>
      expect(reportsApi.demographics).toHaveBeenLastCalledWith(q),
    );
    expect(reportsApi.trends).toHaveBeenLastCalledWith({
      ...q,
      interval: "day",
    });
    expect(reportsApi.coupons).toHaveBeenLastCalledWith({
      ...q,
      page: 1,
      limit: 25,
    });

    await user.click(screen.getByRole("button", { name: "Clear" }));
    await waitFor(() =>
      expect(reportsApi.demographics).toHaveBeenLastCalledWith({}),
    );
  });

  it("a start date after the end date is refused before asking", async () => {
    const user = userEvent.setup();
    render();
    await screen.findByTestId("r-issued");
    const calls = reportsApi.demographics.mock.calls.length;
    await setFilters(user, { from: "2026-10-31", to: "2026-10-01" });
    expect(
      screen.getByText("The start date is after the end date."),
    ).toBeTruthy();
    expect(reportsApi.demographics.mock.calls.length).toBe(calls);
  });

  it("gender split and age bands render the API's numbers (age bands in their order)", async () => {
    render();
    expect((await screen.findByTestId("bar-female")).textContent).toContain(
      "30",
    );
    expect(screen.getByTestId("bar-female").textContent).toContain("(50%)");
    const genders = within(
      screen.getByRole("list", { name: "Customers by gender" }),
    )
      .getAllByRole("listitem")
      .map((li) => li.firstChild.textContent);
    expect(genders).toEqual(["Female", "Male", "Not given", "Other"]);
    const ages = within(
      screen.getByRole("list", { name: "Customers by age band" }),
    )
      .getAllByRole("listitem")
      .map((li) => li.firstChild.textContent);
    expect(ages).toEqual([
      "Under 18",
      "18–24",
      "25–34",
      "35–44",
      "45–54",
      "55+",
      "Not given",
    ]);
    expect(screen.getByTestId("bar-25-34").textContent).toContain("25");
    expect(screen.getByTestId("r-rate").textContent).toContain("40.68%");
  });

  it("the interval switch re-asks the trend", async () => {
    const user = userEvent.setup();
    render();
    await screen.findByRole("table", { name: "Coupons issued and redeemed" });
    await user.click(screen.getByRole("button", { name: "Monthly" }));
    await waitFor(() =>
      expect(reportsApi.trends).toHaveBeenLastCalledWith({ interval: "month" }),
    );
    expect(
      screen
        .getByRole("button", { name: "Monthly" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    const table = await screen.findByRole("table", {
      name: "Coupons issued and redeemed",
    });
    await waitFor(() =>
      expect(within(table).getAllByRole("row")[1].textContent).toContain(
        "Sept 26",
      ),
    );
  });

  it("customer table: name, age band, gender, issue and expiry date, status — and no phone column", async () => {
    render();
    const table = await screen.findByRole("table", { name: "Customers" });
    const [head, first, second] = within(table).getAllByRole("row");
    expect(head.textContent).toBe("CustomerAgeGenderIssuedExpiresStatus");
    expect(head.textContent).not.toMatch(/phone|mobile/i);
    expect(first.textContent).toBe(
      "Priya S.25–34Female1 Nov 20261 Dec 2026Active",
    );
    expect(second.textContent).toContain("Not given");
    expect(screen.getByText("1–25 of 60")).toBeTruthy();
  });

  it("paging: Next / Previous, disabled at the ends", async () => {
    reportsApi.coupons.mockImplementation(async ({ page }) =>
      COUPONS_PAGE(page, 30),
    );
    const user = userEvent.setup();
    render();
    await screen.findByRole("table", { name: "Customers" });
    expect(screen.getByRole("button", { name: "Previous" }).disabled).toBe(
      true,
    );
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("26–30 of 30")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next" }).disabled).toBe(true);
  });

  it("CSV download carries the applied filters, and names the file after them", async () => {
    reportsApi.couponsCsv.mockResolvedValue(
      new Blob(["a,b"], { type: "text/csv" }),
    );
    URL.createObjectURL = vi.fn(() => "blob:csv");
    URL.revokeObjectURL = vi.fn();
    const clicked = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function click() {
        clicked.push({ href: this.href, download: this.download });
      },
    );
    const user = userEvent.setup();
    render();
    await screen.findByTestId("r-issued");
    await setFilters(user, { from: "2026-10-01", status: "expired" });
    await user.click(screen.getByRole("button", { name: /Download CSV/ }));
    await waitFor(() =>
      expect(reportsApi.couponsCsv).toHaveBeenCalledWith({
        from: "2026-10-01",
        status: "expired",
      }),
    );
    expect(clicked).toEqual([
      { href: "blob:csv", download: "coupons-from-2026-10-01-expired.csv" },
    ]);
  });

  it("a failed CSV download says so", async () => {
    reportsApi.couponsCsv.mockRejectedValue(apiError(503, "X"));
    const user = userEvent.setup();
    render();
    await screen.findByTestId("r-issued");
    await user.click(screen.getByRole("button", { name: /Download CSV/ }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "server is having trouble",
    );
  });

  it("empty: nothing in the range", async () => {
    reportsApi.demographics.mockResolvedValue({
      ...DEMOGRAPHICS,
      total: 0,
      gender: { male: 0, female: 0, other: 0, not_given: 0 },
      ageBands: {},
    });
    reportsApi.coupons.mockResolvedValue({
      ...COUPONS_PAGE(1, 0),
      coupons: [],
    });
    render();
    expect(
      (await screen.findAllByText("No customers in this period yet.")).length,
    ).toBe(2);
    expect(
      await screen.findByText("No coupons match these filters."),
    ).toBeTruthy();
  });

  it("errors: each section shows its own, with a retry", async () => {
    reportsApi.coupons.mockRejectedValueOnce(apiError(503, "X"));
    const user = userEvent.setup();
    render();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("server is having trouble");
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("table", { name: "Customers" }),
    ).toBeTruthy();
  });

  it("reportQuery leaves blanks out", () => {
    expect(reportQuery({ from: "", to: "2026-10-31", status: "" })).toEqual({
      to: "2026-10-31",
    });
  });
});
