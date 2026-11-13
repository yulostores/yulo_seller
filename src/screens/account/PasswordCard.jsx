import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/FormError";
import { TextField } from "@/components/Field";
import { authApi } from "@/api/auth.api";
import { useSellerAuth } from "@/context/SellerAuthContext";
import { errorMessage } from "@/lib/errors";

/** The form's rules — the server's (routes/seller/auth.routes.js passwordSchema). */
export function validatePassword(f, hasPassword) {
  const e = {};
  if (hasPassword && !f.current) e.current = "Enter your current password";
  if (f.next.length < 8) e.next = "Use at least 8 characters";
  else if (f.next !== f.confirm) e.confirm = "The two passwords don't match";
  return e;
}

/**
 * Owners can sign in with their phone and a password as well as with an OTP ("Sign in with a
 * password" on the login screen). Setting one needs nothing more; changing it needs the current
 * one (a wrong one answers 401 INVALID_CREDENTIALS, which never ends the session).
 */
export function PasswordCard() {
  const { session, reload } = useSellerAuth();
  const hasPassword = Boolean(session?.hasPassword);
  const empty = { current: "", next: "", confirm: "" };
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    setF((x) => ({ ...x, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: "" }));
    setError("");
    setSaved(false);
  };

  async function submit(e) {
    e.preventDefault();
    const found = validatePassword(f, hasPassword);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await authApi.setPassword(f.next, hasPassword ? f.current : undefined);
      setF(empty);
      setSaved(true);
      await reload().catch(() => {}); // hasPassword is now true
    } catch (err) {
      if (err?.code === "INVALID_CREDENTIALS")
        setErrors({ current: "That isn't your current password" });
      else setError(errorMessage(err, "Could not save the password."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign-in password</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          {hasPassword
            ? "You can sign in with your mobile number and this password, or with a code."
            : "Optional. Set one to sign in with your mobile number and a password instead of a code."}
        </p>
        <form
          onSubmit={submit}
          noValidate
          className="grid gap-4 sm:max-w-sm"
          aria-label="Sign-in password"
        >
          {hasPassword ? (
            <TextField
              id="pw-current"
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={f.current}
              onChange={set("current")}
              error={errors.current}
            />
          ) : null}
          <TextField
            id="pw-new"
            label={hasPassword ? "New password" : "Password"}
            type="password"
            autoComplete="new-password"
            value={f.next}
            onChange={set("next")}
            error={errors.next}
            hint="At least 8 characters"
          />
          <TextField
            id="pw-confirm"
            label="Type it again"
            type="password"
            autoComplete="new-password"
            value={f.confirm}
            onChange={set("confirm")}
            error={errors.confirm}
          />
          <FormError message={error} />
          {saved ? (
            <p role="status" className="text-sm text-brand-green">
              Password saved.
            </p>
          ) : null}
          <div>
            <Button type="submit" disabled={busy}>
              {busy
                ? "Saving…"
                : hasPassword
                  ? "Change password"
                  : "Set password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
