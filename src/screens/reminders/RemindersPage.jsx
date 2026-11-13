import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MessageSquareText, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadState } from "@/components/LoadState";
import { CouponTable } from "@/components/CouponRows";
import { smsApi } from "@/api/seller.api";
import { useSellerAuth } from "@/context/SellerAuthContext";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { openRazorpayCheckout, RazorpayCancelledError } from "@/lib/razorpay";

const CREDITS_KEY = ["sms-credits"];
const REMINDERS_KEY = ["reminders"];

/**
 * Reminder SMS: customers whose coupon expires soon get a text from your credits (1 credit = 1
 * SMS, ₹3.54 including GST), automatically each morning. Buy credit packs here; see who was
 * reminded. No phone numbers are ever shown.
 */
export default function RemindersPage() {
  const credits = useQuery({ queryKey: CREDITS_KEY, queryFn: smsApi.credits });
  const reminders = useQuery({
    queryKey: REMINDERS_KEY,
    queryFn: smsApi.reminders,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold text-brand-dark">Reminder SMS</h1>
      <LoadState query={credits} errorText="Could not load your SMS credits.">
        {(c) => <CreditsCard credits={c} />}
      </LoadState>
      <LoadState query={reminders} errorText="Could not load reminders.">
        {(r) => (
          <>
            <Card>
              <CardHeader>
                <CardTitle>
                  Expiring in the next {r.reminderLeadDays} days
                </CardTitle>
              </CardHeader>
              <CardContent>
                {r.expiringSoon.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No coupons are about to expire.
                  </p>
                ) : (
                  <ExpiringTable rows={r.expiringSoon} />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Sent</CardTitle>
              </CardHeader>
              <CardContent>
                {r.sent.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No reminders sent yet.
                  </p>
                ) : (
                  <ul className="divide-y text-sm" aria-label="Sent reminders">
                    {r.sent.map((s, i) => (
                      <li key={i} className="flex items-center gap-3 py-2.5">
                        <MessageSquareText
                          className="h-4 w-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="flex-1">
                          {s.customerName ?? "Customer"}
                        </span>
                        <span className="text-muted-foreground">
                          {formatDate(s.sentAt ?? s.at)}
                        </span>
                        <Badge
                          variant={
                            s.status === "sent"
                              ? "ok"
                              : s.status === "failed"
                                ? "danger"
                                : "muted"
                          }
                        >
                          {s.status === "sent"
                            ? "Sent"
                            : s.status === "failed"
                              ? "Not delivered"
                              : "Sending"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </LoadState>
    </div>
  );
}

function ExpiringTable({ rows }) {
  return (
    <div className="space-y-2">
      <CouponTable
        rows={rows}
        columns={["customer", "offer", "expiresAt"]}
        caption="Coupons expiring soon"
      />
      <p className="text-xs text-muted-foreground">
        {rows.filter((r) => r.reminded).length} of {rows.length} already
        reminded.
      </p>
    </div>
  );
}

function CreditsCard({ credits }) {
  const { session } = useSellerAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState({ name: "idle" });
  const busy = state.name === "working";

  async function buy(pack) {
    setState({ name: "working", credits: pack.credits });
    let started;
    try {
      started = await smsApi.buy(pack.credits);
    } catch (err) {
      return setState({
        name: "error",
        message: errorMessage(err, "Could not start the purchase."),
      });
    }
    try {
      if (!started.razorpayOrder && started.paymentSimulated)
        await smsApi.simulate(started.purchase._id);
      else {
        const fields = await openRazorpayCheckout(started.razorpayOrder, {
          description: `${pack.credits} reminder SMS credits`,
          prefill: {
            contact: session?.user?.phone
              ? `+91${session.user.phone}`
              : undefined,
            name: session?.user?.name,
          },
        });
        await smsApi.verify(started.purchase._id, fields);
      }
      setState({ name: "done", credits: pack.credits });
      queryClient.invalidateQueries({ queryKey: CREDITS_KEY });
      queryClient.invalidateQueries({ queryKey: REMINDERS_KEY });
    } catch (err) {
      if (err instanceof RazorpayCancelledError)
        return setState({
          name: "error",
          message: err.failureReason
            ? `Payment failed: ${err.failureReason}.`
            : "Payment cancelled. Nothing was charged.",
        });
      if (err?.code === "PAYMENT_VERIFICATION_FAILED")
        return setState({
          name: "error",
          message:
            "The payment couldn't be accepted. If money left your account, it will be refunded.",
        });
      setState({
        name: "error",
        message:
          "We couldn't confirm the payment yet. If it went through, your credits appear within a few minutes.",
      });
      queryClient.invalidateQueries({ queryKey: CREDITS_KEY });
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle>SMS credits</CardTitle>
        <p className="text-sm text-muted-foreground">
          1 credit = 1 SMS ·{" "}
          <strong className="text-foreground">
            {formatPaise(credits.perSms.totalPaise)}
          </strong>{" "}
          per SMS incl. GST
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <p>
          <span
            className="text-3xl font-semibold tabular-nums"
            data-testid="credit-balance"
          >
            {credits.balance.toLocaleString("en-IN")}
          </span>{" "}
          <span className="text-sm text-muted-foreground">credits left</span>
        </p>
        {credits.balance === 0 ? (
          <p className="text-sm text-muted-foreground">
            With no credits, no reminders are sent.
          </p>
        ) : null}
        {credits.available ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {credits.packs.map((p) => (
              <div
                key={p.credits}
                className="rounded-xl border p-4"
                data-testid={`pack-${p.credits}`}
              >
                <p className="font-semibold">
                  {p.credits.toLocaleString("en-IN")} SMS
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatPaise(p.pricePaise)} + GST {formatPaise(p.gstPaise)}
                </p>
                <p className="mt-1 text-lg font-bold">
                  {formatPaise(p.totalPaise)}
                </p>
                <Button
                  className="mt-3 w-full"
                  disabled={busy}
                  onClick={() => buy(p)}
                >
                  {busy && state.credits === p.credits
                    ? "Working…"
                    : `Buy ${p.credits}`}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-secondary/50 p-3 text-sm text-muted-foreground">
            Reminder SMS are coming soon — credit packs will be on sale here.
          </p>
        )}
        {state.name === "done" ? (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-brand-green"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />{" "}
            {state.credits} credits added.
          </p>
        ) : null}
        {state.name === "error" ? (
          <p
            role="alert"
            className="flex items-center gap-2 text-sm text-brand-maroon"
          >
            <XCircle className="h-4 w-4" aria-hidden="true" /> {state.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
