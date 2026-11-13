// CF10 coverage sweep: every seller screen that loads data shows a loading state while its
// request is in flight, and an error (role="alert") when it fails. The per-screen test files
// cover data, empty states and the main interactions; this file guarantees the two states every
// screen must have, so a new screen that forgets one fails here.
import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

vi.mock("@/api/seller.api", async (importOriginal) => {
  const real = await importOriginal();
  const out = {};
  for (const [name, value] of Object.entries(real))
    out[name] =
      value && typeof value === "object"
        ? Object.fromEntries(Object.keys(value).map((fn) => [fn, vi.fn()]))
        : value;
  return out;
});

import * as api from "@/api/seller.api";
import { apiError, renderWith } from "@/test/renderWith";
import { makeSession } from "@/test/sessions";
import DashboardPage from "@/screens/dashboard/DashboardPage";
import ReportsPage from "@/screens/reports/ReportsPage";
import OffersPage from "@/screens/offers/OffersPage";
import RemindersPage from "@/screens/reminders/RemindersPage";
import PlansPage from "@/screens/plans/PlansPage";
import RedeemPage from "@/screens/redeem/RedeemPage";
import AgreementPage from "@/screens/account/AgreementPage";
import { BusinessProfile } from "@/screens/account/BusinessProfile";
import { TeamPanel } from "@/screens/account/TeamPanel";
import OnboardingWizard from "@/screens/onboarding/OnboardingWizard";
import StatusPage from "@/screens/shared/StatusPage";

const everyApiFn = () =>
  Object.values(api)
    .filter((v) => v && typeof v === "object")
    .flatMap((group) => Object.values(group))
    .filter((fn) => typeof fn?.mockImplementation === "function");

function answer(mode) {
  for (const fn of everyApiFn())
    fn.mockImplementation(() =>
      mode === "pending"
        ? new Promise(() => {})
        : Promise.reject(apiError(500, "SERVER_ERROR", "Server is down")),
    );
}

afterEach(() => vi.clearAllMocks());

const owner = makeSession();
const SCREENS = [
  ["Dashboard", () => <DashboardPage />, owner, "/dashboard"],
  ["Reports", () => <ReportsPage />, owner, "/reports"],
  ["Offers", () => <OffersPage />, owner, "/offers"],
  ["Reminders", () => <RemindersPage />, owner, "/reminders"],
  ["Plans", () => <PlansPage />, owner, "/plans"],
  [
    "Redeem (today's list)",
    () => <RedeemPage />,
    makeSession({ role: "employee" }),
    "/redeem",
  ],
  ["Agreement", () => <AgreementPage />, owner, "/agreement"],
  ["Business profile", () => <BusinessProfile />, owner, "/account"],
  ["Team", () => <TeamPanel />, owner, "/account"],
  [
    "Application status",
    () => <StatusPage />,
    makeSession({ status: "pending" }),
    "/status",
  ],
  [
    "Onboarding",
    () => <OnboardingWizard />,
    makeSession({ status: "pending" }),
    "/onboarding",
  ],
];

describe.each(SCREENS)("%s", (_name, ui, session, path) => {
  it("shows a loading state while its data is on the way", async () => {
    answer("pending");
    renderWith(ui(), { session, path });
    expect((await screen.findAllByText(/Loading/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows an error when its data can't be loaded", async () => {
    answer("error");
    renderWith(ui(), { session, path });
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
  });
});
