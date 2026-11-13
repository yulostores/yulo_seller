import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/api/seller.api", () => ({
  smsApi: {
    credits: vi.fn(),
    buy: vi.fn(),
    verify: vi.fn(),
    simulate: vi.fn(),
    reminders: vi.fn(),
  },
}));
vi.mock("@/lib/razorpay", async (importOriginal) => ({
  ...(await importOriginal()),
  openRazorpayCheckout: vi.fn(),
}));

import { smsApi } from "@/api/seller.api";
import { openRazorpayCheckout, RazorpayCancelledError } from "@/lib/razorpay";
import { apiError, renderWith } from "@/test/renderWith";
import { makeSession } from "@/test/sessions";
import { CREDITS, REMINDERS } from "@/test/fixtures";
import RemindersPage from "./RemindersPage";

const render = (role = "owner") =>
  renderWith(<RemindersPage />, {
    session: makeSession({ role }),
    path: "/reminders",
  });
const ORDER = {
  id: "order_sms",
  amount: 35400,
  currency: "INR",
  keyId: "rzp_test",
};
const SIGNED = {
  razorpay_payment_id: "pay_s",
  razorpay_order_id: "order_sms",
  razorpay_signature: "sig",
};

beforeEach(() => {
  smsApi.credits.mockResolvedValue(CREDITS);
  smsApi.reminders.mockResolvedValue(REMINDERS);
});
afterEach(() => vi.clearAllMocks());

describe("Reminder SMS", () => {
  it("balance, ₹3.54 per SMS, and the three packs with price + GST", async () => {
    render();
    expect((await screen.findByTestId("credit-balance")).textContent).toBe(
      "40",
    );
    expect(screen.getByText("₹3.54")).toBeTruthy();
    const p100 = screen.getByTestId("pack-100");
    expect(p100.textContent).toContain("100 SMS");
    expect(p100.textContent).toContain("₹300 + GST ₹54");
    expect(p100.textContent).toContain("₹354");
    expect(screen.getByTestId("pack-1000").textContent).toContain("₹3,540");
  });

  it("buying a pack: Razorpay → verify → credits added, balance refreshed", async () => {
    smsApi.buy.mockResolvedValue({
      purchase: { _id: "pu1" },
      razorpayOrder: ORDER,
      paymentSimulated: false,
    });
    openRazorpayCheckout.mockResolvedValue(SIGNED);
    smsApi.verify.mockResolvedValue({ _id: "pu1", status: "paid" });
    const user = userEvent.setup();
    render();
    await user.click(await screen.findByRole("button", { name: "Buy 100" }));
    expect(smsApi.buy).toHaveBeenCalledWith(100);
    expect(openRazorpayCheckout).toHaveBeenCalledWith(
      ORDER,
      expect.objectContaining({ description: "100 reminder SMS credits" }),
    );
    expect(smsApi.verify).toHaveBeenCalledWith("pu1", SIGNED);
    expect((await screen.findByRole("status")).textContent).toContain(
      "100 credits added",
    );
    await waitFor(() => expect(smsApi.credits).toHaveBeenCalledTimes(2));
  });

  it("checkout dismissed: nothing charged; verify refused: refund promised", async () => {
    smsApi.buy.mockResolvedValue({
      purchase: { _id: "pu1" },
      razorpayOrder: ORDER,
      paymentSimulated: false,
    });
    openRazorpayCheckout.mockRejectedValueOnce(new RazorpayCancelledError());
    const user = userEvent.setup();
    render();
    await user.click(await screen.findByRole("button", { name: "Buy 500" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Payment cancelled. Nothing was charged.",
    );
    expect(smsApi.verify).not.toHaveBeenCalled();

    openRazorpayCheckout.mockResolvedValueOnce(SIGNED);
    smsApi.verify.mockRejectedValueOnce(
      apiError(400, "PAYMENT_VERIFICATION_FAILED"),
    );
    await user.click(screen.getByRole("button", { name: "Buy 500" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("refunded"),
    );
  });

  it("credits not on sale yet (no real SMS provider): 'coming soon', no Buy buttons", async () => {
    smsApi.credits.mockResolvedValue({
      ...CREDITS,
      balance: 0,
      available: false,
    });
    render();
    expect(await screen.findByText(/coming soon/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Buy/ })).toBeNull();
    expect(
      screen.getByText("With no credits, no reminders are sent."),
    ).toBeTruthy();
  });

  it("expiring-soon list (masked names, offer, expiry) and how many were reminded", async () => {
    render();
    const table = await screen.findByRole("table", {
      name: "Coupons expiring soon",
    });
    const rows = within(table).getAllByRole("row");
    expect(rows[0].textContent).toBe("CustomerOfferExpires");
    expect(rows[1].textContent).toBe("Priya S.20% off any haircut1 Dec 2026");
    expect(screen.getByText("1 of 2 already reminded.")).toBeTruthy();
    expect(screen.getByText("Expiring in the next 3 days")).toBeTruthy();
  });

  it("sent log", async () => {
    render();
    const list = await screen.findByRole("list", { name: "Sent reminders" });
    expect(list.textContent).toContain("Priya S.");
    expect(list.textContent).toContain("10 Nov 2026");
    expect(list.textContent).toContain("Sent");
  });

  it("empty lists and a load error with retry", async () => {
    smsApi.reminders
      .mockRejectedValueOnce(apiError(503, "X"))
      .mockResolvedValue({ ...REMINDERS, expiringSoon: [], sent: [] });
    const user = userEvent.setup();
    render();
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(
      await screen.findByText("No coupons are about to expire."),
    ).toBeTruthy();
    expect(screen.getByText("No reminders sent yet.")).toBeTruthy();
  });
});
