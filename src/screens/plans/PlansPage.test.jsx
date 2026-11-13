import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/api/seller.api", () => ({
  plansApi: {
    list: vi.fn(),
    subscriptions: vi.fn(),
    buy: vi.fn(),
    verify: vi.fn(),
    simulate: vi.fn(),
  },
}));
// Checkout itself is mocked; the cancelled-error class is the real one.
vi.mock("@/lib/razorpay", async (importOriginal) => ({
  ...(await importOriginal()),
  openRazorpayCheckout: vi.fn(),
}));

import { plansApi } from "@/api/seller.api";
import { openRazorpayCheckout, RazorpayCancelledError } from "@/lib/razorpay";
import { canVisit } from "@/routes/access";
import { apiError, renderWith } from "@/test/renderWith";
import { makeSession } from "@/test/sessions";
import PlansPage from "./PlansPage";

// GET /api/seller/plans, as the server answers (planView).
const PLANS = [
  {
    _id: "p1",
    key: "basic",
    name: "Basic",
    gstPercent: 18,
    couponAllocation: 250,
    basePaise: 500000,
    gstPaise: 90000,
    totalPaise: 590000,
    price: { base: 5000, gst: 900, total: 5900 },
    isActive: true,
    sortOrder: 1,
    online: {
      handlingFeePercent: 3.5,
      handlingFeePaise: 17500,
      gstPaise: 93150,
      totalPaise: 610650,
      price: { base: 5000, handlingFee: 175, gst: 931.5, total: 6106.5 },
    },
  },
  {
    _id: "p2",
    key: "plus",
    name: "Plus",
    gstPercent: 18,
    couponAllocation: 900,
    basePaise: 1500000,
    gstPaise: 270000,
    totalPaise: 1770000,
    price: { base: 15000, gst: 2700, total: 17700 },
    isActive: true,
    sortOrder: 2,
    online: {
      handlingFeePercent: 3.5,
      handlingFeePaise: 52500,
      gstPaise: 279450,
      totalPaise: 1831950,
      price: { base: 15000, handlingFee: 525, gst: 2794.5, total: 18319.5 },
    },
  },
  {
    _id: "p3",
    key: "premium",
    name: "Premium",
    gstPercent: 18,
    couponAllocation: 4000,
    basePaise: 5000000,
    gstPaise: 900000,
    totalPaise: 5900000,
    price: { base: 50000, gst: 9000, total: 59000 },
    isActive: true,
    sortOrder: 3,
    online: {
      handlingFeePercent: 3.5,
      handlingFeePaise: 175000,
      gstPaise: 931500,
      totalPaise: 6106500,
      price: { base: 50000, handlingFee: 1750, gst: 9315, total: 61065 },
    },
  },
];

const sub = (over = {}) => ({
  _id: "sub1",
  plan: { key: "basic", name: "Basic", couponAllocation: 250 },
  status: "active",
  amount: {
    basePaise: 500000,
    gstPaise: 90000,
    totalPaise: 590000,
    total: 5900,
  },
  paidPaise: 590000,
  method: "razorpay",
  reference: "pay_ABC123",
  allocated: 250,
  issued: 60,
  remaining: 190,
  activatedAt: "2026-11-01T06:00:00.000Z",
  exhaustedAt: null,
  createdAt: "2026-11-01T05:59:00.000Z",
  ...over,
});
const NONE = {
  subscriptions: [],
  stock: { allocated: 0, issued: 0, remaining: 0 },
  currentPlan: null,
};
const ONE = {
  subscriptions: [sub()],
  stock: { allocated: 250, issued: 60, remaining: 190 },
  currentPlan: sub(),
};
const RZP_ORDER = {
  id: "order_1",
  amount: 590000,
  currency: "INR",
  keyId: "rzp_test_x",
};
const SIGNED = {
  razorpay_payment_id: "pay_1",
  razorpay_order_id: "order_1",
  razorpay_signature: "sig",
};

const render = (role = "owner") =>
  renderWith(<PlansPage />, { session: makeSession({ role }), path: "/plans" });

beforeEach(() => {
  plansApi.list.mockResolvedValue(PLANS);
  plansApi.subscriptions.mockResolvedValue(NONE);
});
afterEach(() => vi.clearAllMocks());

describe("Plans — what's shown", () => {
  // Production, before the seed script was run: no plans existed and the page showed nothing.
  it("no plans on sale: says so instead of an empty space", async () => {
    plansApi.list.mockResolvedValue([]);
    render();
    expect(
      await screen.findByText(
        "No plans are on sale right now. Please contact Yulo.",
      ),
    ).toBeTruthy();
  });

  it("three plan cards: price, 3.5% payment handling fee, GST on both, online total; offline price noted", async () => {
    render();
    const basic = await screen.findByTestId("plan-basic");
    expect(within(basic).getByText("250 coupons")).toBeTruthy();
    expect(within(basic).getByText("₹5,000")).toBeTruthy();
    expect(within(basic).getByText("Payment handling fee (3.5%)")).toBeTruthy();
    expect(within(basic).getByText("₹175")).toBeTruthy();
    expect(within(basic).getByText("GST (18%)")).toBeTruthy();
    expect(within(basic).getByText("₹931.50")).toBeTruthy();
    expect(within(basic).getByTestId("total-basic").textContent).toBe(
      "₹6,106.50",
    );
    expect(
      within(basic).getByText("₹24.43 per coupon, all included"),
    ).toBeTruthy();
    expect(within(basic).getByTestId("offline-basic").textContent).toContain(
      "₹5,900 incl. GST — no handling fee",
    );
    expect(screen.getByTestId("total-plus").textContent).toBe("₹18,319.50");
    const premium = screen.getByTestId("plan-premium");
    expect(within(premium).getByText("4,000 coupons")).toBeTruthy();
    expect(screen.getByTestId("total-premium").textContent).toBe("₹61,065");
  });

  it("an older API without the online breakdown still shows price + GST", async () => {
    plansApi.list.mockResolvedValue(PLANS.map(({ online, ...p }) => p));
    render();
    const basic = await screen.findByTestId("plan-basic");
    expect(within(basic).queryByText(/handling fee/)).toBeNull();
    expect(within(basic).getByTestId("total-basic").textContent).toBe("₹5,900");
  });

  it("no plan yet: says so, and 'Choose a plan'", async () => {
    render();
    expect(await screen.findByText(/You don't have a plan yet/)).toBeTruthy();
    expect(screen.getByText("Choose a plan")).toBeTruthy();
    expect(screen.getByText("No purchases yet.")).toBeTruthy();
  });

  it("current plan card: bought / given / left and a progress bar", async () => {
    plansApi.subscriptions.mockResolvedValue(ONE);
    render();
    expect(await screen.findByText("Basic plan")).toBeTruthy();
    expect(screen.getByTestId("stock-Coupons bought").textContent).toBe("250");
    expect(screen.getByTestId("stock-Given to customers").textContent).toBe(
      "60",
    );
    expect(screen.getByTestId("stock-Left to give").textContent).toBe("190");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "24",
    );
    expect(screen.getByText("Add more coupons")).toBeTruthy();
  });

  it("used up: says there's nothing left to give", async () => {
    plansApi.subscriptions.mockResolvedValue({
      subscriptions: [sub({ status: "exhausted", issued: 250, remaining: 0 })],
      stock: { allocated: 250, issued: 250, remaining: 0 },
      currentPlan: sub({ status: "exhausted", issued: 250, remaining: 0 }),
    });
    render();
    expect(await screen.findByText(/no coupons left to give/)).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "100",
    );
  });

  it("purchase history: method, amount, date, reference; abandoned checkouts left out", async () => {
    plansApi.subscriptions.mockResolvedValue({
      ...ONE,
      subscriptions: [
        sub(),
        sub({
          _id: "sub2",
          plan: { key: "plus", name: "Plus", couponAllocation: 900 },
          method: "manual",
          reference: "UTR998877",
          paidPaise: 1770000,
          activatedAt: "2026-10-05T06:00:00.000Z",
        }),
        sub({
          _id: "sub3",
          status: "pending_payment",
          reference: null,
          paidPaise: null,
          activatedAt: null,
        }),
      ],
    });
    render();
    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("1 Nov 2026");
    expect(rows[0].textContent).toContain("Online (Razorpay)");
    expect(rows[0].textContent).toContain("₹5,900");
    expect(rows[0].textContent).toContain("pay_ABC123");
    expect(rows[1].textContent).toContain("Paid to Yulo directly");
    expect(rows[1].textContent).toContain("₹17,700");
    expect(rows[1].textContent).toContain("UTR998877");
    expect(rows[1].textContent).toContain("5 Oct 2026");
  });

  it("the 'paid directly? contact Yulo' note is there", async () => {
    render();
    expect(await screen.findByText(/Paid Yulo directly/)).toBeTruthy();
    expect(screen.getByText("Contact Yulo")).toBeTruthy();
  });

  it("loading failures can be retried", async () => {
    plansApi.list.mockRejectedValueOnce(apiError(503, "X"));
    const user = userEvent.setup();
    render();
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("plan-basic")).toBeTruthy();
  });
});

describe("Plans — buying (owner)", () => {
  it("success: order → Razorpay Checkout → verify → activated", async () => {
    plansApi.buy.mockResolvedValue({
      subscription: sub({ status: "pending_payment" }),
      razorpayOrder: RZP_ORDER,
      paymentSimulated: false,
    });
    openRazorpayCheckout.mockResolvedValue(SIGNED);
    plansApi.verify.mockResolvedValue(sub());
    const user = userEvent.setup();
    render("owner");
    await user.click(await screen.findByRole("button", { name: "Buy Basic" }));
    expect(plansApi.buy).toHaveBeenCalledWith("basic");
    expect(openRazorpayCheckout).toHaveBeenCalledWith(
      RZP_ORDER,
      expect.objectContaining({ description: "Basic plan — 250 coupons" }),
    );
    expect(plansApi.verify).toHaveBeenCalledWith("sub1", SIGNED);
    expect((await screen.findByRole("status")).textContent).toContain(
      "Basic plan activated.",
    );
    expect(screen.getByRole("status").textContent).toContain(
      "250 coupons are ready",
    );
    await waitFor(() =>
      expect(plansApi.subscriptions).toHaveBeenCalledTimes(2),
    ); // refreshed
  });

  it("dismissed: 'nothing was charged', buttons usable again; a failed attempt names the reason", async () => {
    plansApi.buy.mockResolvedValue({
      subscription: sub({ status: "pending_payment" }),
      razorpayOrder: RZP_ORDER,
      paymentSimulated: false,
    });
    openRazorpayCheckout.mockRejectedValueOnce(new RazorpayCancelledError());
    const user = userEvent.setup();
    render("owner");
    await user.click(await screen.findByRole("button", { name: "Buy Basic" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Payment cancelled. Nothing was charged.",
    );
    expect(plansApi.verify).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Buy Plus" }).disabled).toBe(
      false,
    );

    openRazorpayCheckout.mockRejectedValueOnce(
      new RazorpayCancelledError("Card declined by bank"),
    );
    await user.click(screen.getByRole("button", { name: "Buy Plus" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Payment failed: Card declined by bank",
    );
  });

  it("verify refused: the payment wasn't accepted (refund promised)", async () => {
    plansApi.buy.mockResolvedValue({
      subscription: sub({ status: "pending_payment" }),
      razorpayOrder: RZP_ORDER,
      paymentSimulated: false,
    });
    openRazorpayCheckout.mockResolvedValue(SIGNED);
    plansApi.verify.mockRejectedValue(
      apiError(400, "PAYMENT_VERIFICATION_FAILED"),
    );
    const user = userEvent.setup();
    render("owner");
    await user.click(await screen.findByRole("button", { name: "Buy Basic" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "couldn't be accepted",
    );
    expect(screen.getByRole("alert").textContent).toContain("refunded");
  });

  it("verify got no answer: never called a failure — 'check again' finds the plan the webhook activated", async () => {
    plansApi.buy.mockResolvedValue({
      subscription: sub({ status: "pending_payment" }),
      razorpayOrder: RZP_ORDER,
      paymentSimulated: false,
    });
    openRazorpayCheckout.mockResolvedValue(SIGNED);
    plansApi.verify.mockRejectedValue(
      Object.assign(new Error("Network Error"), { isApiError: true }),
    );
    plansApi.subscriptions.mockResolvedValue({
      ...NONE,
      subscriptions: [sub({ status: "pending_payment" })],
    });
    const user = userEvent.setup();
    render("owner");
    await user.click(await screen.findByRole("button", { name: "Buy Basic" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "couldn't confirm your payment yet",
    );

    plansApi.subscriptions.mockResolvedValue(ONE); // the webhook activated it meanwhile
    await user.click(screen.getByRole("button", { name: "Check again" }));
    expect((await screen.findByRole("status")).textContent).toContain(
      "Basic plan activated.",
    );
  });

  it("a second payment for a paid plan: told it will be refunded", async () => {
    plansApi.buy.mockResolvedValue({
      subscription: sub({ status: "pending_payment" }),
      razorpayOrder: RZP_ORDER,
      paymentSimulated: false,
    });
    openRazorpayCheckout.mockResolvedValue(SIGNED);
    plansApi.verify.mockRejectedValue(apiError(409, "ALREADY_PAID"));
    const user = userEvent.setup();
    render("owner");
    await user.click(await screen.findByRole("button", { name: "Buy Basic" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "second payment will be refunded",
    );
  });

  it("starting the purchase failed: the server's reason, Checkout never opened", async () => {
    plansApi.buy.mockRejectedValue(
      apiError(503, "PAYMENT_GATEWAY_UNAVAILABLE", "x"),
    );
    const user = userEvent.setup();
    render("owner");
    await user.click(
      await screen.findByRole("button", { name: "Buy Premium" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "server is having trouble",
    );
    expect(openRazorpayCheckout).not.toHaveBeenCalled();
  });

  it("local development with simulated payments: no Checkout, the simulate endpoint activates", async () => {
    plansApi.buy.mockResolvedValue({
      subscription: sub({ status: "pending_payment" }),
      razorpayOrder: null,
      paymentSimulated: true,
    });
    plansApi.simulate.mockResolvedValue(sub());
    const user = userEvent.setup();
    render("owner");
    await user.click(await screen.findByRole("button", { name: "Buy Basic" }));
    expect(plansApi.simulate).toHaveBeenCalledWith("sub1");
    expect(openRazorpayCheckout).not.toHaveBeenCalled();
    expect((await screen.findByRole("status")).textContent).toContain(
      "activated",
    );
  });

  it("while paying, every Buy button is disabled (no double purchase)", async () => {
    let resolveBuy;
    plansApi.buy.mockReturnValue(new Promise((r) => (resolveBuy = r)));
    const user = userEvent.setup();
    render("owner");
    await user.click(await screen.findByRole("button", { name: "Buy Basic" }));
    expect(screen.getByRole("button", { name: "Starting…" }).disabled).toBe(
      true,
    );
    expect(screen.getByRole("button", { name: "Buy Plus" }).disabled).toBe(
      true,
    );
    resolveBuy({
      subscription: sub(),
      razorpayOrder: null,
      paymentSimulated: true,
    });
    plansApi.simulate.mockResolvedValue(sub());
  });
});

describe("Plans — roles", () => {
  it("a manager sees plans, stock and history read-only: no Buy buttons", async () => {
    plansApi.subscriptions.mockResolvedValue(ONE);
    render("manager");
    await screen.findByTestId("plan-basic");
    expect(
      screen.getByText("Only the owner of the business can buy a plan."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Buy/ })).toBeNull();
    expect(screen.getByRole("table")).toBeTruthy();
  });

  it("employees never reach the Plans screen; owners and managers do", () => {
    expect(canVisit(makeSession({ role: "employee" }), "/plans")).toBe(false);
    expect(canVisit(makeSession({ role: "manager" }), "/plans")).toBe(true);
    expect(canVisit(makeSession({ role: "owner" }), "/plans")).toBe(true);
  });
});
