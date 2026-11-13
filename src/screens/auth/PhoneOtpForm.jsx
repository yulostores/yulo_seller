import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormError } from "@/components/FormError";
import { useSellerAuth } from "@/context/SellerAuthContext";
import { errorMessage, fieldError } from "@/lib/errors";
import { isValidPhone, sanitizePhoneInput, toPhoneDigits } from "@/lib/phone";

const RESEND_SECONDS = 30;

/**
 * Phone → one-time code. Calls `onVerified(result)` with what the server said
 * (SellerAuthContext#verifyOtp: a session, "needs signup" or "choose an account").
 */
export function PhoneOtpForm({ onVerified, submitLabel = "Continue" }) {
  const { sendOtp, verifyOtp } = useSellerAuth();
  const [step, setStep] = useState("phone");
  const [phoneText, setPhoneText] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devOtp, setDevOtp] = useState(null);
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function requestCode(number) {
    setError("");
    setBusy(true);
    try {
      const res = await sendOtp(number);
      setPhone(number);
      setDevOtp(res?.devOtp ?? null);
      setStep("code");
      setWait(RESEND_SECONDS);
    } catch (err) {
      setPhoneError(fieldError(err, "phone") ?? "");
      if (!fieldError(err, "phone"))
        setError(
          errorMessage(err, "Could not send the code. Please try again."),
        );
    } finally {
      setBusy(false);
    }
  }

  function submitPhone(e) {
    e.preventDefault();
    const digits = toPhoneDigits(phoneText);
    if (!isValidPhone(digits)) {
      setPhoneError("Enter a valid 10-digit mobile number");
      return;
    }
    setPhoneError("");
    requestCode(digits);
  }

  async function submitCode(e) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const result = await verifyOtp(phone, code);
      await onVerified({ ...result, phone });
    } catch (err) {
      setError(
        errorMessage(err, "Could not check the code. Please try again."),
      );
      setBusy(false);
    }
  }

  if (step === "phone") {
    return (
      <form onSubmit={submitPhone} noValidate className="space-y-5">
        <div>
          <Label htmlFor="phone">Mobile number</Label>
          <Input
            id="phone"
            name="phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="98765 43210"
            className="mt-2"
            value={phoneText}
            aria-invalid={Boolean(phoneError)}
            aria-describedby={phoneError ? "phone-error" : undefined}
            onChange={(e) => {
              setPhoneText(sanitizePhoneInput(e.target.value));
              setPhoneError("");
            }}
          />
          <FieldError id="phone-error" message={phoneError} />
        </div>
        <FormError message={error} />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Sending code…" : "Send code"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submitCode} noValidate className="space-y-5">
      <p className="text-sm text-muted-foreground">
        We sent a 6-digit code to{" "}
        <span className="font-semibold text-foreground">+91 {phone}</span>.{" "}
        <button
          type="button"
          className="font-medium text-primary underline-offset-4 hover:underline"
          onClick={() => {
            setStep("phone");
            setCode("");
            setError("");
          }}
        >
          Change number
        </button>
      </p>
      <div>
        <Label htmlFor="code">Code</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="••••••"
          className="mt-2 tracking-[0.4em]"
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          autoFocus
        />
        {devOtp ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Development code: {devOtp}
          </p>
        ) : null}
      </div>
      <FormError message={error} />
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Checking…" : submitLabel}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {wait > 0 ? (
          <>Resend code in {wait}s</>
        ) : (
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            disabled={busy}
            onClick={() => requestCode(phone)}
          >
            Resend code
          </button>
        )}
      </p>
    </form>
  );
}
