import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/FormError";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { useSellerAuth } from "@/context/SellerAuthContext";
import { errorMessage } from "@/lib/errors";
import { isValidPhone, sanitizePhoneInput, toPhoneDigits } from "@/lib/phone";
import { PATHS } from "@/routes/access";
import { AccountChooser } from "./AccountChooser";
import { PhoneOtpForm } from "./PhoneOtpForm";

/**
 * Sign in with a one-time code (everyone) or a password (owners who set one). A number with no
 * business yet continues straight into sign-up; a number with logins at several businesses picks
 * one.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("otp");
  const [choice, setChoice] = useState(null);

  // "/" sends the new session to its own home screen (routes/access.js#homeFor).
  const goHome = () => navigate("/", { replace: true });

  async function onVerified(result) {
    if (result.kind === "session") return goHome();
    if (result.kind === "signup") {
      return navigate(PATHS.signup, {
        state: { signupToken: result.signupToken, phone: result.phone },
      });
    }
    setChoice(result);
  }

  if (choice) {
    return (
      <AuthLayout
        title="Choose a business"
        subtitle={`Signed in as +91 ${choice.phone}`}
      >
        <AccountChooser
          selectToken={choice.selectToken}
          accounts={choice.accounts}
          onSelected={goHome}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Owners, managers and staff of Yulo coupon partners."
      footer={
        <>
          New to Yulo?{" "}
          <Link
            to={PATHS.signup}
            className="font-semibold text-primary hover:underline"
          >
            Register your business
          </Link>
        </>
      }
    >
      {mode === "otp" ? (
        <PhoneOtpForm onVerified={onVerified} submitLabel="Sign in" />
      ) : (
        <PasswordForm onSignedIn={goHome} />
      )}
      <p className="mt-5 text-center text-sm">
        <button
          type="button"
          className="font-medium text-muted-foreground hover:text-foreground hover:underline"
          onClick={() => setMode((m) => (m === "otp" ? "password" : "otp"))}
        >
          {mode === "otp"
            ? "Owner? Sign in with a password"
            : "Sign in with a one-time code"}
        </button>
      </p>
    </AuthLayout>
  );
}

function PasswordForm({ onSignedIn }) {
  const { passwordLogin } = useSellerAuth();
  const [phoneText, setPhoneText] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const phone = toPhoneDigits(phoneText);
    if (!isValidPhone(phone))
      return setError("Enter a valid 10-digit mobile number");
    if (!password) return setError("Enter your password");
    setError("");
    setBusy(true);
    try {
      await passwordLogin(phone, password);
      onSignedIn();
    } catch (err) {
      setError(errorMessage(err, "Could not sign in. Please try again."));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div>
        <Label htmlFor="pw-phone">Mobile number</Label>
        <Input
          id="pw-phone"
          inputMode="tel"
          autoComplete="tel"
          className="mt-2"
          value={phoneText}
          onChange={(e) => setPhoneText(sanitizePhoneInput(e.target.value))}
        />
      </div>
      <div>
        <Label htmlFor="pw-password">Password</Label>
        <Input
          id="pw-password"
          type="password"
          autoComplete="current-password"
          className="mt-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <FormError message={error} />
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
