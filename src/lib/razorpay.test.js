import { afterEach, describe, expect, it } from "vitest";

import { openRazorpayCheckout, RazorpayCancelledError } from "./razorpay";

// A stand-in for Razorpay's Checkout SDK (window.Razorpay): records its options and lets the test
// play the payer.
function installFakeRazorpay() {
  const fake = { instances: [] };
  window.Razorpay = function Razorpay(options) {
    const handlers = {};
    const instance = {
      options,
      handlers,
      on: (event, fn) => (handlers[event] = fn),
      open: () => (instance.opened = true),
    };
    fake.instances.push(instance);
    return instance;
  };
  return fake;
}

afterEach(() => {
  delete window.Razorpay;
  document
    .querySelectorAll('script[src*="checkout.razorpay.com"]')
    .forEach((s) => s.remove());
});

const ORDER = {
  id: "order_1",
  amount: 590000,
  currency: "INR",
  keyId: "rzp_test_key",
};

describe("openRazorpayCheckout", () => {
  it("opens Checkout with the backend's order and key; resolves with the three fields verify needs", async () => {
    const fake = installFakeRazorpay();
    const promise = openRazorpayCheckout(ORDER, { description: "Basic plan" });
    await Promise.resolve();
    const [rzp] = fake.instances;
    expect(rzp.opened).toBe(true);
    expect(rzp.options).toMatchObject({
      key: "rzp_test_key",
      order_id: "order_1",
      amount: 590000,
      currency: "INR",
      description: "Basic plan",
      name: "Yulo Partner",
    });
    rzp.options.handler({
      razorpay_payment_id: "pay_1",
      razorpay_order_id: "order_1",
      razorpay_signature: "sig",
      extra: "ignored",
    });
    await expect(promise).resolves.toEqual({
      razorpay_payment_id: "pay_1",
      razorpay_order_id: "order_1",
      razorpay_signature: "sig",
    });
    expect(
      document.querySelector('script[src*="checkout.razorpay.com"]'),
    ).toBeNull();
  });

  it("closed by the payer: rejects as cancelled — with the reason when an attempt failed first", async () => {
    const fake = installFakeRazorpay();
    const plain = openRazorpayCheckout(ORDER);
    await Promise.resolve();
    fake.instances[0].options.modal.ondismiss();
    await expect(plain).rejects.toBeInstanceOf(RazorpayCancelledError);

    const failed = openRazorpayCheckout(ORDER);
    await Promise.resolve();
    const rzp = fake.instances[1];
    rzp.handlers["payment.failed"]({ error: { description: "Card declined" } });
    rzp.options.modal.ondismiss();
    const err = await failed.catch((e) => e);
    expect(err.failureReason).toBe("Card declined");
    expect(err.message).toBe("Payment failed: Card declined");
  });

  it("loads the SDK script once when it isn't on the page", async () => {
    const promise = openRazorpayCheckout(ORDER);
    const script = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );
    expect(script).toBeTruthy();
    const fake = installFakeRazorpay();
    script.onload();
    await new Promise((r) => setTimeout(r, 0));
    expect(fake.instances).toHaveLength(1);
    fake.instances[0].options.modal.ondismiss();
    await expect(promise).rejects.toBeInstanceOf(RazorpayCancelledError);
  });
});
