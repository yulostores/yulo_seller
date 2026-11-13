// Razorpay Checkout for the web, as yulo_menu opens it (yulo_menu/src/lib/razorpay.js): the SDK is
// loaded on demand and opened with the order the backend created ({ id, amount, currency, keyId }
// — the key is the backend's public key id; nothing is configured in this app).

let scriptPromise = null;

function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(
        new Error(
          "Couldn't load the payment gateway. Check your connection and try again.",
        ),
      );
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
}

/**
 * The payer closed Checkout. `failureReason` is set when an attempt inside it failed first
 * (Razorpay keeps the sheet open after a failure so another method can be tried).
 */
export class RazorpayCancelledError extends Error {
  constructor(failureReason = null) {
    super(
      failureReason
        ? `Payment failed: ${failureReason}`
        : "Payment was cancelled",
    );
    this.name = "RazorpayCancelledError";
    this.failureReason = failureReason;
  }
}

/** Resolves with { razorpay_payment_id, razorpay_order_id, razorpay_signature } — what verify needs. */
export async function openRazorpayCheckout(
  razorpayOrder,
  { name = "Yulo Partner", description, prefill } = {},
) {
  await loadRazorpayScript();
  return new Promise((resolve, reject) => {
    let failureReason = null;
    const rzp = new window.Razorpay({
      key: razorpayOrder.keyId,
      order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      name,
      description,
      prefill,
      theme: { color: "#A4161A" },
      handler: (response) =>
        resolve({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
        }),
      modal: {
        ondismiss: () => reject(new RazorpayCancelledError(failureReason)),
      },
    });
    rzp.on("payment.failed", (response) => {
      failureReason =
        response?.error?.description ?? "the payment didn't go through";
    });
    rzp.open();
  });
}
