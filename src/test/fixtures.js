// API response fixtures for the seller screens, shaped exactly as the backend's views (pinned by
// yulo_backend/server/test/coupon-api-responses.test.js).
//
// Every customer row also carries a `customerPhone` the server NEVER sends — a stand-in for a leak.
// Screens render known fields only, so it must never reach the DOM (see noPhone.test.jsx).
export const LEAKED_CUSTOMER_PHONE = "9876543210";

export const couponRow = (over = {}) => ({
  id: "c1",
  customerName: "Priya S.",
  gender: "female",
  ageBand: "25-34",
  offerTitle: "20% off any haircut",
  category: "Salon",
  issuedAt: "2026-11-01T06:00:00.000Z",
  expiresAt: "2026-12-01T06:00:00.000Z",
  status: "issued",
  redeemedAt: null,
  redeemedByName: null,
  customerPhone: LEAKED_CUSTOMER_PHONE,
  ...over,
});

export const DASHBOARD = {
  plans: [],
  currentPlan: {
    _id: "sub1",
    plan: { key: "basic", name: "Basic", couponAllocation: 250 },
    status: "active",
  },
  stock: { allocated: 250, issued: 60, pending: 190 },
  coupons: {
    issued: 60,
    active: 31,
    redeemed: 24,
    expired: 4,
    void: 1,
    redemptionRate: 40,
  },
  redemptionRate: 40,
  recentCoupons: [
    couponRow(),
    couponRow({
      id: "c2",
      customerName: "Rahul V.",
      gender: "male",
      status: "redeemed",
      redeemedAt: "2026-11-03T06:00:00.000Z",
      redeemedByName: "Ravi Kumar",
    }),
  ],
};

export const series = (n = 3, interval = "day") =>
  Array.from({ length: n }, (_, i) => ({
    bucket:
      interval === "month"
        ? `2026-${String(9 + i).padStart(2, "0")}`
        : `2026-11-${String(i + 1).padStart(2, "0")}`,
    issued: i + 2,
    redeemed: i,
  }));

export const TRENDS = {
  interval: "day",
  from: "2026-11-01",
  to: "2026-11-03",
  status: null,
  series: series(),
  totals: { issued: 9, redeemed: 3 },
};

export const DEMOGRAPHICS = {
  filters: {},
  total: 60,
  counts: {
    issued: 59,
    active: 31,
    redeemed: 24,
    expired: 4,
    void: 1,
    redemptionRate: 40.68,
  },
  gender: { male: 22, female: 30, other: 2, not_given: 6 },
  ageBands: {
    "under-18": 1,
    "18-24": 12,
    "25-34": 25,
    "35-44": 10,
    "45-54": 6,
    "55+": 2,
    "not-given": 4,
  },
};

export const COUPONS_PAGE = (page = 1, total = 60) => ({
  filters: {},
  coupons: [
    couponRow({ id: `r${page}a` }),
    couponRow({
      id: `r${page}b`,
      customerName: "Kiran",
      gender: "other",
      ageBand: "not-given",
      status: "expired",
    }),
  ],
  total,
  page,
  limit: 25,
});

export const OFFERS = [
  {
    _id: "o1",
    title: "20% off any haircut",
    terms: "Weekdays only",
    validityDays: 30,
    status: "approved",
    rejectionReason: null,
    categoryId: "c",
    reviewedAt: null,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-02T00:00:00.000Z",
  },
  {
    _id: "o2",
    title: "Free hair wash",
    terms: "",
    validityDays: null,
    status: "draft",
    rejectionReason: null,
    categoryId: "c",
    reviewedAt: null,
    createdAt: "2026-11-03T00:00:00.000Z",
    updatedAt: "2026-11-03T00:00:00.000Z",
  },
  {
    _id: "o3",
    title: "FREE EVERYTHING",
    terms: "",
    validityDays: null,
    status: "rejected",
    rejectionReason: "Offers must be honest",
    categoryId: "c",
    reviewedAt: null,
    createdAt: "2026-11-03T00:00:00.000Z",
    updatedAt: "2026-11-04T00:00:00.000Z",
  },
  {
    _id: "o4",
    title: "Spa day",
    terms: "",
    validityDays: 60,
    status: "paused",
    rejectionReason: null,
    categoryId: "c",
    reviewedAt: null,
    createdAt: "2026-11-03T00:00:00.000Z",
    updatedAt: "2026-11-04T00:00:00.000Z",
  },
  {
    _id: "o5",
    title: "Beard trim",
    terms: "",
    validityDays: null,
    status: "pending_review",
    rejectionReason: null,
    categoryId: "c",
    reviewedAt: null,
    createdAt: "2026-11-03T00:00:00.000Z",
    updatedAt: "2026-11-05T00:00:00.000Z",
  },
];

export const CREDITS = {
  balance: 40,
  perSms: {
    pricePaise: 300,
    gstPaise: 54,
    totalPaise: 354,
    total: 3.54,
    gstPercent: 18,
  },
  packs: [
    {
      credits: 100,
      pricePaise: 30000,
      gstPaise: 5400,
      totalPaise: 35400,
      total: 354,
    },
    {
      credits: 500,
      pricePaise: 150000,
      gstPaise: 27000,
      totalPaise: 177000,
      total: 1770,
    },
    {
      credits: 1000,
      pricePaise: 300000,
      gstPaise: 54000,
      totalPaise: 354000,
      total: 3540,
    },
  ],
  available: true,
  purchases: [],
};

export const REMINDERS = {
  credits: 40,
  reminderLeadDays: 3,
  perSms: CREDITS.perSms,
  expiringSoon: [
    couponRow({ id: "e1", reminded: true }),
    couponRow({ id: "e2", customerName: "Rahul V.", reminded: false }),
  ],
  sent: [
    {
      customerName: "Priya S.",
      status: "sent",
      sentAt: "2026-11-10T04:40:00.000Z",
      at: "2026-11-10T04:40:00.000Z",
      customerPhone: LEAKED_CUSTOMER_PHONE,
    },
  ],
};
