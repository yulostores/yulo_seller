import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";

import {
  COUPONS_PAGE,
  CREDITS,
  DASHBOARD,
  DEMOGRAPHICS,
  LEAKED_CUSTOMER_PHONE,
  OFFERS,
  REMINDERS,
  TRENDS,
  couponRow,
} from "./fixtures";

// Every seller API answers with fixture data in which customer rows carry a stray `customerPhone`.
vi.mock("@/api/seller.api", async () => {
  const f = await import("./fixtures");
  const sub = {
    _id: "s1",
    plan: { key: "basic", name: "Basic", couponAllocation: 250 },
    status: "active",
    amount: { totalPaise: 590000 },
    paidPaise: 590000,
    method: "razorpay",
    reference: "pay_1",
    allocated: 250,
    issued: 60,
    remaining: 190,
    activatedAt: "2026-11-01T00:00:00.000Z",
    createdAt: "2026-11-01T00:00:00.000Z",
  };
  const redeemRow = {
    ...f.couponRow(),
    code: "KM4T7QXH2P",
    customerFirstName: "Priya",
    redeemedAt: "2026-11-12T05:00:00.000Z",
    redeemedByName: "Ravi",
  };
  return {
    reportsApi: {
      dashboard: async () => f.DASHBOARD,
      trends: async () => f.TRENDS,
      demographics: async () => f.DEMOGRAPHICS,
      coupons: async () => f.COUPONS_PAGE(1),
      couponsCsv: async () => new Blob([]),
    },
    offersApi: { list: async () => f.OFFERS },
    smsApi: {
      credits: async () => f.CREDITS,
      reminders: async () => f.REMINDERS,
    },
    plansApi: {
      list: async () => [],
      subscriptions: async () => ({
        subscriptions: [sub],
        stock: { allocated: 250, issued: 60, remaining: 190 },
        currentPlan: sub,
      }),
    },
    redeemApi: {
      today: async () => ({
        scope: "business",
        count: 1,
        redemptions: [redeemRow],
      }),
      lookup: async () => redeemRow,
      redeem: async () => redeemRow,
    },
  };
});

import { renderWith } from "./renderWith";
import { makeSession } from "./sessions";
import DashboardPage from "@/screens/dashboard/DashboardPage";
import ReportsPage from "@/screens/reports/ReportsPage";
import OffersPage from "@/screens/offers/OffersPage";
import RemindersPage from "@/screens/reminders/RemindersPage";
import PlansPage from "@/screens/plans/PlansPage";
import RedeemPage from "@/screens/redeem/RedeemPage";

// Any Indian mobile number: 10 digits starting 6–9, optionally spaced / +91.
const PHONE = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/;

const SCREENS = [
  ["Dashboard", DashboardPage, "Recent coupons"],
  ["Reports", ReportsPage, "Priya S."],
  ["Offers", OffersPage, "Free hair wash"],
  ["Reminder SMS", RemindersPage, "Rahul V."],
  ["Plans", PlansPage, "Basic plan"],
  ["Redeem Coupon", RedeemPage, "by Ravi"],
];

describe("no customer phone number ever reaches a seller screen", () => {
  for (const [name, Screen, loadedText] of SCREENS) {
    it(name, async () => {
      const { container } = renderWith(<Screen />, {
        session: makeSession({ role: "owner" }),
        path: "/x",
      });
      await waitFor(() => expect(container.textContent).toContain(loadedText));
      expect(container.innerHTML).not.toContain(LEAKED_CUSTOMER_PHONE);
      expect(container.textContent).not.toMatch(PHONE);
    });
  }

  it("the fixtures really do carry a phone (so the test can fail)", () => {
    expect(
      JSON.stringify([DASHBOARD, COUPONS_PAGE(1), REMINDERS, couponRow()]),
    ).toContain(LEAKED_CUSTOMER_PHONE);
    void [TRENDS, DEMOGRAPHICS, OFFERS, CREDITS, screen];
  });
});
