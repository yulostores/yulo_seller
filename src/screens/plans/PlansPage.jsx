import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Info, Ticket, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/Spinner";
import { plansApi } from "@/api/seller.api";
import { useSellerAuth } from "@/context/SellerAuthContext";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/dates";
import { formatPaise, formatRupees } from "@/lib/money";
import { openRazorpayCheckout, RazorpayCancelledError } from "@/lib/razorpay";
import { planHeading } from "@/lib/plans";

export const PLANS_KEY = ["plans"];
export const SUBSCRIPTIONS_KEY = ["subscriptions"];

/**
 * Plans: the current plan's coupon stock, the plans on sale (owner buys through Razorpay), and every
 * purchase. Managers see it all read-only; employees never reach this screen (routes/access.js).
 */
export default function PlansPage() {
  const { session } = useSellerAuth();
  const isOwner = session?.user?.role === "owner";
  const queryClient = useQueryClient();
  const plans = useQuery({ queryKey: PLANS_KEY, queryFn: plansApi.list });
  const subs = useQuery({
    queryKey: SUBSCRIPTIONS_KEY,
    queryFn: plansApi.subscriptions,
  });
  const [purchase, setPurchase] = useState({ state: "idle" });

  const refreshSubs = () =>
    queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_KEY });

  async function buy(plan) {
    setPurchase({ state: "starting", planKey: plan.key });
    let started;
    try {
      started = await plansApi.buy(plan.key);
    } catch (err) {
      return setPurchase({
        state: "failed",
        message: errorMessage(
          err,
          "Could not start the purchase. Please try again.",
        ),
      });
    }
    const subscriptionId = started.subscription._id;
    try {
      let activated;
      if (!started.razorpayOrder && started.paymentSimulated) {
        activated = await plansApi.simulate(subscriptionId); // local development only
      } else {
        setPurchase({ state: "checkout", planKey: plan.key });
        const fields = await openRazorpayCheckout(started.razorpayOrder, {
          description: `${plan.name} plan — ${plan.couponAllocation} coupons`,
          prefill: {
            contact: session?.user?.phone
              ? `+91${session.user.phone}`
              : undefined,
            name: session?.user?.name,
          },
        });
        setPurchase({ state: "verifying", planKey: plan.key });
        activated = await plansApi.verify(subscriptionId, fields);
      }
      setPurchase({ state: "success", subscription: activated });
      refreshSubs();
    } catch (err) {
      if (err instanceof RazorpayCancelledError) {
        return setPurchase({ state: "cancelled", reason: err.failureReason });
      }
      if (err?.code === "PAYMENT_VERIFICATION_FAILED") {
        return setPurchase({
          state: "failed",
          message:
            "The payment couldn't be accepted for this plan. If money left your account, it will be refunded automatically.",
        });
      }
      if (err?.code === "ALREADY_PAID") {
        refreshSubs();
        return setPurchase({
          state: "failed",
          message:
            "This plan was already paid — the second payment will be refunded.",
        });
      }
      // No answer, or the server stumbled: the payment may well have gone through (the payment
      // webhook activates the plan by itself). Never call it failed — check.
      setPurchase({ state: "unconfirmed", subscriptionId, planKey: plan.key });
      refreshSubs();
    }
  }

  async function checkAgain() {
    const fresh = await queryClient.fetchQuery({
      queryKey: SUBSCRIPTIONS_KEY,
      queryFn: plansApi.subscriptions,
    });
    const sub = fresh.subscriptions.find(
      (s) => s._id === purchase.subscriptionId,
    );
    if (sub && sub.status !== "pending_payment")
      setPurchase({ state: "success", subscription: sub });
  }

  const busy = ["starting", "checkout", "verifying"].includes(purchase.state);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold text-brand-dark">Plans</h1>

      <PurchaseBanner
        purchase={purchase}
        onCheckAgain={checkAgain}
        onClose={() => setPurchase({ state: "idle" })}
      />

      {subs.isLoading ? (
        <Spinner />
      ) : subs.isError ? (
        <LoadError error={subs.error} onRetry={subs.refetch} />
      ) : (
        <CurrentPlan data={subs.data} />
      )}

      <section aria-labelledby="plans-heading" className="space-y-3">
        <h2 id="plans-heading" className="text-lg font-semibold">
          {subs.data?.currentPlan ? "Add more coupons" : "Choose a plan"}
        </h2>
        {!isOwner ? (
          <p className="text-sm text-muted-foreground">
            Only the owner of the business can buy a plan.
          </p>
        ) : null}
        {plans.isLoading ? (
          <Spinner />
        ) : plans.isError ? (
          <LoadError error={plans.error} onRetry={plans.refetch} />
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {plans.data.map((p) => (
              <PlanCard
                key={p.key}
                plan={p}
                canBuy={isOwner}
                busy={busy}
                working={busy && purchase.planKey === p.key}
                state={purchase.state}
                onBuy={() => buy(p)}
              />
            ))}
          </div>
        )}
        <p className="flex items-start gap-2 rounded-xl border bg-white p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Paid Yulo directly — bank transfer, UPI or cheque?{" "}
            <strong className="text-foreground">Contact Yulo</strong> with your
            payment reference and they&apos;ll record it; the plan starts
            straight away.
          </span>
        </p>
      </section>

      <section aria-labelledby="history-heading" className="space-y-3">
        <h2 id="history-heading" className="text-lg font-semibold">
          Purchase history
        </h2>
        {subs.data ? <History subscriptions={subs.data.subscriptions} /> : null}
      </section>
    </div>
  );
}

function CurrentPlan({ data }) {
  const { stock, currentPlan, activePlans } = data;
  if (!currentPlan) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          You don&apos;t have a plan yet. Customers start receiving your coupons
          as soon as you buy one and your offer is approved.
        </CardContent>
      </Card>
    );
  }
  const used = stock.allocated
    ? Math.min(100, Math.round((stock.issued / stock.allocated) * 100))
    : 0;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-brand-orange" aria-hidden="true" />{" "}
          {planHeading(activePlans, currentPlan)}
        </CardTitle>
        <Badge variant={currentPlan.status === "active" ? "ok" : "muted"}>
          {currentPlan.status === "active" ? "Active" : "Used up"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-3 gap-3 text-center">
          {[
            ["Coupons bought", stock.allocated],
            ["Given to customers", stock.issued],
            ["Left to give", stock.remaining],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-secondary/50 p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-2xl font-bold" data-testid={`stock-${label}`}>
                {value.toLocaleString("en-IN")}
              </dd>
            </div>
          ))}
        </dl>
        <div>
          <div
            role="progressbar"
            aria-label="Coupons given out"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={used}
            className="h-2.5 overflow-hidden rounded-full bg-secondary"
          >
            <div
              className="h-full rounded-full bg-brand-gradient"
              style={{ width: `${used}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {used}% given out
          </p>
        </div>
        {stock.remaining === 0 ? (
          <p className="text-sm font-medium text-brand-maroon">
            You have no coupons left to give. Buy a plan to keep reaching
            customers.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PlanCard({ plan, canBuy, busy, working, state, onBuy }) {
  const label = working
    ? state === "checkout"
      ? "Complete the payment…"
      : state === "verifying"
        ? "Confirming…"
        : "Starting…"
    : `Buy ${plan.name}`;
  return (
    <Card className="flex flex-col" data-testid={`plan-${plan.key}`}>
      <CardHeader>
        <CardTitle>{plan.name}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {plan.couponAllocation.toLocaleString("en-IN")} coupons
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Price</dt>
            <dd>{formatRupees(plan.price.base)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">GST ({plan.gstPercent}%)</dt>
            <dd>{formatRupees(plan.price.gst)}</dd>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <dt>Total</dt>
            <dd>{formatRupees(plan.price.total)}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          {formatPaise(Math.round(plan.totalPaise / plan.couponAllocation))} per
          coupon, GST included
        </p>
        <div className="mt-auto">
          {canBuy ? (
            <Button className="w-full" disabled={busy} onClick={onBuy}>
              {label}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function PurchaseBanner({ purchase, onCheckAgain, onClose }) {
  const { state } = purchase;
  if (state === "success") {
    const s = purchase.subscription;
    return (
      <Banner tone="ok" icon={CheckCircle2} onClose={onClose}>
        <strong>{s.plan.name} plan activated.</strong>{" "}
        {s.allocated.toLocaleString("en-IN")} coupons are ready to reach
        customers.
      </Banner>
    );
  }
  if (state === "cancelled") {
    return (
      <Banner tone="warn" icon={XCircle} onClose={onClose}>
        {purchase.reason
          ? `Payment failed: ${purchase.reason}. Nothing was charged — you can try again.`
          : "Payment cancelled. Nothing was charged."}
      </Banner>
    );
  }
  if (state === "failed") {
    return (
      <Banner tone="error" icon={XCircle} onClose={onClose}>
        {purchase.message}
      </Banner>
    );
  }
  if (state === "unconfirmed") {
    return (
      <Banner tone="warn" icon={Info} onClose={onClose}>
        We couldn&apos;t confirm your payment yet. If it went through, your plan
        activates by itself within a few minutes.{" "}
        <button
          type="button"
          className="font-semibold underline"
          onClick={onCheckAgain}
        >
          Check again
        </button>
      </Banner>
    );
  }
  return null;
}

const TONES = {
  ok: "border-brand-green/30 bg-[#E8F5EC] text-brand-green",
  warn: "border-brand-orange/30 bg-[#FFF3E0] text-[#8a3a0a]",
  error: "border-brand-maroon/20 bg-[#FCE9E4] text-brand-maroon",
};
function Banner({ tone, icon: Icon, children, onClose }) {
  return (
    <div
      role={tone === "ok" ? "status" : "alert"}
      className={`flex items-start gap-2 rounded-xl border p-4 text-sm ${TONES[tone]}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="flex-1">{children}</p>
      <button
        type="button"
        aria-label="Dismiss"
        className="opacity-60 hover:opacity-100"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}

const STATUS = {
  active: ["Active", "ok"],
  exhausted: ["Used up", "muted"],
  cancelled: ["Cancelled", "danger"],
};

function History({ subscriptions }) {
  // Abandoned checkouts (still pending_payment) aren't purchases — they're left out.
  const rows = subscriptions.filter((s) => s.status !== "pending_payment");
  if (rows.length === 0)
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        No purchases yet.
      </p>
    );
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5">Date</th>
            <th className="px-4 py-2.5">Plan</th>
            <th className="px-4 py-2.5">Paid by</th>
            <th className="px-4 py-2.5 text-right">Amount</th>
            <th className="px-4 py-2.5">Reference</th>
            <th className="px-4 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((s) => {
            const [label, variant] = STATUS[s.status] ?? [s.status, "muted"];
            return (
              <tr key={s._id}>
                <td className="px-4 py-2.5">
                  {formatDate(s.activatedAt ?? s.createdAt)}
                </td>
                <td className="px-4 py-2.5">
                  {s.plan.name}{" "}
                  <span className="text-muted-foreground">
                    · {s.plan.couponAllocation.toLocaleString("en-IN")} coupons
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {s.method === "manual"
                    ? "Paid to Yulo directly"
                    : "Online (Razorpay)"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {formatPaise(s.paidPaise ?? s.amount.totalPaise)}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">
                  {s.reference ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant={variant}>{label}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LoadError({ error, onRetry }) {
  return (
    <Card>
      <CardContent className="p-6 text-sm">
        <p role="alert" className="text-red-700">
          {errorMessage(error, "Could not load this.")}
        </p>
        <Button className="mt-4" onClick={() => onRetry()}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
