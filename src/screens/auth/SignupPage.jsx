import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormError } from "@/components/FormError";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { authApi } from "@/api/auth.api";
import { useSellerAuth } from "@/context/SellerAuthContext";
import { errorMessage, fieldError } from "@/lib/errors";
import { PATHS } from "@/routes/access";
import { PhoneOtpForm } from "./PhoneOtpForm";

// Limits in step with signupSchema (yulo_backend/server/routes/seller/auth.routes.js).
const BUSINESS_MIN = 2;
const BUSINESS_MAX = 120;
const NAME_MIN = 2;
const NAME_MAX = 100;

export function validateSignup({ businessName, categoryId, ownerName }) {
  const errors = {};
  const b = businessName.trim();
  if (b.length < BUSINESS_MIN) errors.businessName = "Enter the business name";
  else if (b.length > BUSINESS_MAX)
    errors.businessName = `At most ${BUSINESS_MAX} characters`;
  if (!categoryId) errors.categoryId = "Choose what kind of business it is";
  const o = ownerName.trim();
  if (o.length < NAME_MIN) errors.ownerName = "Enter your name";
  else if (o.length > NAME_MAX)
    errors.ownerName = `At most ${NAME_MAX} characters`;
  return errors;
}

/**
 * Register a business: phone → code → business name, category, owner name. Arriving from the
 * login screen with an unregistered number skips straight to the details (the code was checked).
 */
export default function SignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [proof, setProof] = useState(() =>
    location.state?.signupToken
      ? { signupToken: location.state.signupToken, phone: location.state.phone }
      : null,
  );
  const [notice, setNotice] = useState("");

  async function onVerified(result) {
    if (result.kind === "signup")
      return setProof({ signupToken: result.signupToken, phone: result.phone });
    if (result.kind === "session") return navigate("/", { replace: true }); // already registered — signed in
    setNotice(
      "This number already has a login. Sign in to choose your business.",
    );
  }

  return (
    <AuthLayout
      title={proof ? "Your business" : "Register your business"}
      subtitle={
        proof
          ? `Mobile verified: +91 ${proof.phone}`
          : "Start with the mobile number you'll sign in with."
      }
      footer={
        <>
          Already registered?{" "}
          <Link
            to={PATHS.login}
            className="font-semibold text-primary hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      {notice ? <FormError message={notice} /> : null}
      {proof ? (
        <DetailsForm
          proof={proof}
          onDone={() => navigate("/", { replace: true })}
        />
      ) : (
        <PhoneOtpForm onVerified={onVerified} />
      )}
    </AuthLayout>
  );
}

function DetailsForm({ proof, onDone }) {
  const { signup } = useSellerAuth();
  const categories = useQuery({
    queryKey: ["signup-categories"],
    queryFn: authApi.categories,
    staleTime: 10 * 60_000,
  });
  const [form, setForm] = useState({
    businessName: "",
    categoryId: "",
    ownerName: "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((x) => ({ ...x, [field]: "" }));
  };

  async function submit(e) {
    e.preventDefault();
    const found = validateSignup(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setError("");
    setBusy(true);
    try {
      await signup({
        signupToken: proof.signupToken,
        businessName: form.businessName.trim(),
        categoryId: form.categoryId,
        ownerName: form.ownerName.trim(),
      });
      onDone();
    } catch (err) {
      const server = {
        businessName: fieldError(err, "businessName"),
        categoryId: fieldError(err, "categoryId"),
        ownerName: fieldError(err, "ownerName"),
      };
      if (Object.values(server).some(Boolean)) setErrors(server);
      else
        setError(
          err?.status === 401
            ? "Your verification has expired. Please start again."
            : errorMessage(
                err,
                "Could not create your business. Please try again.",
              ),
        );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div>
        <Label htmlFor="businessName">Business name</Label>
        <Input
          id="businessName"
          className="mt-2"
          value={form.businessName}
          onChange={set("businessName")}
          maxLength={BUSINESS_MAX}
          aria-invalid={Boolean(errors.businessName)}
        />
        <FieldError message={errors.businessName} />
      </div>
      <div>
        <Label htmlFor="categoryId">Category</Label>
        <select
          id="categoryId"
          className="mt-2 flex h-10 w-full rounded-lg border border-input bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={form.categoryId}
          onChange={set("categoryId")}
          disabled={categories.isLoading}
          aria-invalid={Boolean(errors.categoryId)}
        >
          <option value="">
            {categories.isLoading ? "Loading…" : "Choose a category"}
          </option>
          {(categories.data ?? []).map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
        {categories.isError ? (
          <p className="mt-1.5 text-xs text-red-600">
            Could not load categories.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => categories.refetch()}
            >
              Try again
            </button>
          </p>
        ) : null}
        <FieldError message={errors.categoryId} />
      </div>
      <div>
        <Label htmlFor="ownerName">Your name</Label>
        <Input
          id="ownerName"
          autoComplete="name"
          className="mt-2"
          value={form.ownerName}
          onChange={set("ownerName")}
          maxLength={NAME_MAX}
          aria-invalid={Boolean(errors.ownerName)}
        />
        <FieldError message={errors.ownerName} />
      </div>
      <FormError message={error} />
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Creating…" : "Create my business"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Next you&apos;ll add your shop details and ID documents for Yulo to
        review.
      </p>
    </form>
  );
}
