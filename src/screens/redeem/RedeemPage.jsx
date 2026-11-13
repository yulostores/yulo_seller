import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  QrCode,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { redeemApi } from "@/api/seller.api";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/dates";
import {
  cleanCode,
  codeFromQr,
  displayCode,
  isCompleteCode,
} from "@/lib/couponCode";

const TODAY_KEY = ["redeem-today"];

// The scanner (and its QR decoder) is downloaded only when Scan QR is tapped — most visits type.
const QrScanner = lazy(() =>
  import("@/components/QrScanner").then((m) => ({ default: m.QrScanner })),
);

const timeIst = (value) =>
  value
    ? new Date(value).toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      })
    : "";
const whenIst = (value) =>
  value ? `${timeIst(value)}, ${formatDate(value)}` : "";

/**
 * Turns a refusal (from lookup or redeem) into what the counter should read. `coupon` is the
 * lookup result when there is one (its status explains redeemed / expired / void without a call).
 */
export function outcomeFor(err, coupon = null) {
  const code = err?.code;
  if (code === "COUPON_ALREADY_REDEEMED" || coupon?.status === "redeemed") {
    const d = err?.details ?? coupon ?? {};
    return {
      tone: "error",
      icon: XCircle,
      title: "Already redeemed",
      text: d.redeemedAt
        ? `Used ${whenIst(d.redeemedAt)}${d.redeemedByName ? ` by ${d.redeemedByName}` : ""}.`
        : "This coupon has already been used.",
    };
  }
  if (code === "COUPON_EXPIRED" || coupon?.status === "expired") {
    const at = err?.details?.expiresAt ?? coupon?.expiresAt;
    return {
      tone: "error",
      icon: Clock,
      title: "Expired",
      text: at
        ? `This coupon expired on ${formatDate(at)}.`
        : "This coupon has expired.",
    };
  }
  if (code === "COUPON_VOID" || coupon?.status === "void") {
    return {
      tone: "error",
      icon: XCircle,
      title: "No longer valid",
      text: "The order this coupon came with was refunded, so it can't be used.",
    };
  }
  if (code === "COUPON_NOT_FOUND") {
    return {
      tone: "warn",
      icon: Search,
      title: "Code not found",
      text: "No coupon with this code for your business. Check the code with the customer.",
    };
  }
  if (code === "PHONE_MISMATCH") {
    return {
      tone: "warn",
      icon: ShieldAlert,
      title: "Phone number doesn't match",
      text: "Those last 4 digits aren't the customer's. Ask them to check their number.",
    };
  }
  if (code === "PHONE_CHECK_REQUIRED") {
    return {
      tone: "warn",
      icon: ShieldAlert,
      title: "Phone check needed",
      text: "Ask the customer for the last 4 digits of their mobile number.",
    };
  }
  if (code === "REDEEM_LOCKED") {
    return {
      tone: "error",
      icon: AlertTriangle,
      title: "Paused for 15 minutes",
      text: "Too many wrong codes were tried. Redemption is paused for a while — check codes carefully.",
    };
  }
  if (code === "RATE_LIMITED") {
    return {
      tone: "warn",
      icon: AlertTriangle,
      title: "Slow down",
      text: "Too many checks in a minute. Wait a moment and try again.",
    };
  }
  return {
    tone: "error",
    icon: AlertTriangle,
    title: "Something went wrong",
    text: errorMessage(err, "Please try again."),
  };
}

/**
 * Redeem Coupon — used at the counter, mostly on a phone: type or scan the code, see the offer,
 * confirm. Every button is large enough for a thumb.
 */
export default function RedeemPage() {
  const queryClient = useQueryClient();
  const inputRef = useRef(null);
  const redeemingRef = useRef(false); // a second tap on Confirm while the first is in flight does nothing
  const [code, setCode] = useState("");
  const [step, setStep] = useState({ name: "enter" }); // enter | checking | preview | redeeming | done
  const [outcome, setOutcome] = useState(null);
  const [phoneLast4, setPhoneLast4] = useState("");
  const [scanning, setScanning] = useState(false);

  const reset = () => {
    setCode("");
    setPhoneLast4("");
    setOutcome(null);
    setStep({ name: "enter" });
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  async function check(theCode = code) {
    setOutcome(null);
    if (!isCompleteCode(theCode)) {
      setOutcome({
        tone: "warn",
        icon: Search,
        title: "Check the code",
        text: "Coupon codes are 10 letters and numbers.",
      });
      return;
    }
    setStep({ name: "checking" });
    try {
      const coupon = await redeemApi.lookup(theCode);
      setPhoneLast4("");
      if (coupon.status !== "issued") {
        setOutcome(outcomeFor(null, coupon));
        setStep({ name: "preview", coupon });
      } else setStep({ name: "preview", coupon });
    } catch (err) {
      setOutcome(outcomeFor(err));
      setStep({ name: "enter" });
    }
  }

  async function confirm() {
    if (redeemingRef.current) return;
    const coupon = step.coupon;
    if (coupon.needsPhoneCheck && !/^\d{4}$/.test(phoneLast4)) {
      setOutcome(outcomeFor({ code: "PHONE_CHECK_REQUIRED" }));
      return;
    }
    redeemingRef.current = true;
    setOutcome(null);
    setStep({ name: "redeeming", coupon });
    try {
      const redeemed = await redeemApi.redeem(
        coupon.code,
        phoneLast4 || undefined,
      );
      setStep({ name: "done", coupon: redeemed });
      queryClient.invalidateQueries({ queryKey: TODAY_KEY });
    } catch (err) {
      setOutcome(outcomeFor(err, null));
      // A wrong phone check can be retried on the same coupon; anything else starts over.
      const retryable =
        err?.code === "PHONE_MISMATCH" ||
        err?.code === "PHONE_CHECK_REQUIRED" ||
        err?.code === "RATE_LIMITED";
      setStep(retryable ? { name: "preview", coupon } : { name: "enter" });
      if (err?.code === "COUPON_ALREADY_REDEEMED")
        queryClient.invalidateQueries({ queryKey: TODAY_KEY });
    } finally {
      redeemingRef.current = false;
    }
  }

  const onScan = useCallback((text) => {
    setScanning(false);
    const scanned = codeFromQr(text);
    if (!scanned) {
      setOutcome({
        tone: "warn",
        icon: QrCode,
        title: "Not a Yulo coupon",
        text: "That QR code isn't a coupon code. Ask the customer to open the coupon in the Yulo app.",
      });
      return;
    }
    setCode(scanned);
    check(scanned);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-bold text-brand-dark">Redeem Coupon</h1>

      {step.name === "done" ? (
        <Success coupon={step.coupon} onNext={reset} />
      ) : (
        <Card>
          <CardContent className="space-y-4 p-5">
            {step.name === "enter" || step.name === "checking" ? (
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  check();
                }}
                className="space-y-3"
              >
                <label htmlFor="coupon-code" className="text-sm font-medium">
                  Coupon code
                </label>
                <input
                  id="coupon-code"
                  ref={inputRef}
                  value={displayCode(code)}
                  onChange={(e) => {
                    setCode(cleanCode(e.target.value));
                    setOutcome(null);
                  }}
                  autoFocus
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="ABCDE-23456"
                  className="h-16 w-full rounded-xl border-2 border-input bg-white px-4 text-center font-mono text-2xl tracking-[0.2em] uppercase focus:border-primary focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 text-base"
                    onClick={() => setScanning(true)}
                  >
                    <QrCode aria-hidden="true" /> Scan QR
                  </Button>
                  <Button
                    type="submit"
                    className="h-14 text-base"
                    disabled={step.name === "checking" || code.length === 0}
                  >
                    {step.name === "checking" ? "Checking…" : "Check code"}
                  </Button>
                </div>
              </form>
            ) : (
              <Preview
                coupon={step.coupon}
                busy={step.name === "redeeming"}
                phoneLast4={phoneLast4}
                setPhoneLast4={setPhoneLast4}
                onConfirm={confirm}
                onCancel={reset}
              />
            )}
            {outcome ? <Outcome outcome={outcome} /> : null}
          </CardContent>
        </Card>
      )}

      {scanning ? (
        <Suspense
          fallback={
            <div
              role="status"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 text-sm text-white"
            >
              Opening the camera…
            </div>
          }
        >
          <QrScanner onScan={onScan} onClose={() => setScanning(false)} />
        </Suspense>
      ) : null}

      <TodayList />
    </div>
  );
}

const STATUS = {
  issued: ["Valid", "ok"],
  redeemed: ["Already used", "danger"],
  expired: ["Expired", "muted"],
  void: ["Not valid", "danger"],
};

function Preview({
  coupon,
  busy,
  phoneLast4,
  setPhoneLast4,
  onConfirm,
  onCancel,
}) {
  const [label, variant] = STATUS[coupon.status] ?? [coupon.status, "muted"];
  const usable = coupon.status === "issued";
  return (
    <div className="space-y-4" data-testid="coupon-preview">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm text-muted-foreground">
            {displayCode(coupon.code)}
          </p>
          <h2 className="text-xl font-bold">{coupon.offerTitle}</h2>
          {coupon.category ? (
            <p className="text-sm text-muted-foreground">{coupon.category}</p>
          ) : null}
        </div>
        <Badge variant={variant}>{label}</Badge>
      </div>
      {coupon.terms ? (
        <p className="rounded-lg bg-secondary/50 p-3 text-sm">{coupon.terms}</p>
      ) : null}
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Customer</dt>
          <dd className="text-lg font-semibold">
            {coupon.customerFirstName ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Valid until</dt>
          <dd className="text-lg font-semibold">
            {formatDate(coupon.expiresAt)}
          </dd>
        </div>
      </dl>
      {usable && coupon.needsPhoneCheck ? (
        <div>
          <label htmlFor="phone-last4" className="text-sm font-medium">
            Last 4 digits of the customer&apos;s mobile
          </label>
          <input
            id="phone-last4"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={phoneLast4}
            onChange={(e) =>
              setPhoneLast4(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            className="mt-2 h-14 w-full rounded-xl border-2 border-input bg-white px-4 text-center font-mono text-2xl tracking-[0.5em] focus:border-primary focus:outline-none"
          />
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-14 text-base"
          onClick={onCancel}
          disabled={busy}
        >
          {usable ? "Cancel" : "Check another"}
        </Button>
        {usable ? (
          <Button
            type="button"
            className="h-14 text-base"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Redeeming…" : "Confirm redeem"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

const TONES = {
  error: "border-brand-maroon/20 bg-[#FCE9E4] text-brand-maroon",
  warn: "border-brand-orange/30 bg-[#FFF3E0] text-[#8a3a0a]",
};
function Outcome({ outcome }) {
  const Icon = outcome.icon;
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border p-4 ${TONES[outcome.tone]}`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">{outcome.title}</p>
        <p className="text-sm">{outcome.text}</p>
      </div>
    </div>
  );
}

function Success({ coupon, onNext }) {
  return (
    <Card className="border-brand-green/30">
      <CardContent className="space-y-4 p-6 text-center" role="status">
        <CheckCircle2
          className="mx-auto h-16 w-16 text-brand-green"
          aria-hidden="true"
        />
        <p className="text-2xl font-bold text-brand-green">Redeemed</p>
        <div>
          <p className="text-lg font-semibold">{coupon.offerTitle}</p>
          <p className="text-sm text-muted-foreground">
            {coupon.customerFirstName
              ? `for ${coupon.customerFirstName} · `
              : ""}
            {timeIst(coupon.redeemedAt)}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {displayCode(coupon.code)}
          </p>
        </div>
        <Button className="h-14 w-full text-base" onClick={onNext} autoFocus>
          Redeem another
        </Button>
      </CardContent>
    </Card>
  );
}

function TodayList() {
  const today = useQuery({
    queryKey: TODAY_KEY,
    queryFn: redeemApi.today,
    refetchInterval: 60_000,
  });
  const data = today.data;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Today&apos;s redemptions</CardTitle>
        {data ? <Badge variant="muted">{data.count}</Badge> : null}
      </CardHeader>
      <CardContent>
        {today.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : today.isError ? (
          <p role="alert" className="text-sm text-red-700">
            Couldn&apos;t load today&apos;s list.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => today.refetch()}
            >
              Try again
            </button>
          </p>
        ) : data.redemptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {data.scope === "mine"
              ? "You haven't redeemed any coupons today."
              : "No coupons redeemed today yet."}
          </p>
        ) : (
          <ul className="divide-y" aria-label="Today's redemptions">
            {data.redemptions.map((r) => (
              <li
                key={r.code}
                className="flex items-center gap-3 py-2.5 text-sm"
              >
                <span className="w-16 shrink-0 text-muted-foreground">
                  {timeIst(r.redeemedAt)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {r.offerTitle}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {r.customerFirstName ?? "Customer"}
                    {data.scope === "business" && r.redeemedByName
                      ? ` · by ${r.redeemedByName}`
                      : ""}
                  </span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {displayCode(r.code)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
