import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/Spinner";
import { onboardingApi } from "@/api/seller.api";
import { useSellerAuth } from "@/context/SellerAuthContext";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { PATHS } from "@/routes/access";
import { BusinessStep } from "./BusinessStep";
import { OwnerStep } from "./OwnerStep";
import { TeamStep } from "./TeamStep";
import { DocumentsStep } from "./DocumentsStep";
import { ReviewStep } from "./ReviewStep";
import { resumeStep, STEPS } from "./validate";

export const ONBOARDING_KEY = ["onboarding"];
const stepKey = (sellerId) => `yulo_seller_onboarding_step:${sellerId}`;
const readStep = (sellerId) => {
  try {
    const raw = localStorage.getItem(stepKey(sellerId));
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
};
const writeStep = (sellerId, i) => {
  try {
    localStorage.setItem(stepKey(sellerId), String(i));
  } catch {
    /* fine */
  }
};

/**
 * The application: Business → Owner → Team → Documents → Review & submit. Each step saves to the
 * server on its own, so closing the tab loses nothing; coming back resumes at the step last open
 * (never past the first one still incomplete).
 */
export default function OnboardingWizard() {
  const { session, reload } = useSellerAuth();
  const sellerId = session?.seller?._id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ONBOARDING_KEY,
    queryFn: onboardingApi.get,
  });
  const [step, setStep] = useState(null);

  // Decide where to resume once the application has loaded.
  useEffect(() => {
    if (query.data && step === null)
      setStep(resumeStep(query.data.missing, readStep(sellerId)));
  }, [query.data, step, sellerId]);
  useEffect(() => {
    if (step !== null && sellerId) writeStep(sellerId, step);
  }, [step, sellerId]);

  if (query.isLoading || (query.data && step === null))
    return <Spinner label="Loading your application…" />;
  if (query.isError) {
    return (
      <Shell>
        <p role="alert" className="text-sm text-red-700">
          {errorMessage(query.error, "Could not load your application.")}
        </p>
        <Button className="mt-4" onClick={() => query.refetch()}>
          Try again
        </Button>
      </Shell>
    );
  }
  const form = query.data;
  if (!form.editable) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">
          Your business is approved — its details are on the Profile page.
        </p>
      </Shell>
    );
  }

  const saved = (view, next = step + 1) => {
    queryClient.setQueryData(ONBOARDING_KEY, view);
    setStep(Math.min(next, STEPS.length - 1));
  };

  const submitted = async (view) => {
    queryClient.setQueryData(ONBOARDING_KEY, view);
    queryClient.invalidateQueries({ queryKey: ["seller-status"] });
    try {
      localStorage.removeItem(stepKey(sellerId));
    } catch {
      /* fine */
    }
    await reload().catch(() => {});
    navigate(PATHS.status, { replace: true });
  };

  const done = (i) => {
    const key = STEPS[i].key;
    if (key === "business") return !form.missing.includes("business");
    if (key === "owner") return !form.missing.includes("owner");
    if (key === "team") return (form.employees ?? []).length > 0;
    if (key === "documents")
      return !form.missing.some((m) => m.startsWith("document:"));
    return false;
  };

  return (
    <Shell
      rejectionReason={form.status === "rejected" ? form.rejectionReason : null}
    >
      <ol className="mb-6 flex flex-wrap gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => setStep(i)}
              aria-current={i === step ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                i === step
                  ? "border-primary bg-primary text-white"
                  : done(i)
                    ? "border-brand-green/40 bg-[#E8F5EC] text-brand-green"
                    : "bg-white text-muted-foreground",
              )}
            >
              {done(i) && i !== step ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <span>{i + 1}.</span>
              )}
              {s.label}
            </button>
          </li>
        ))}
      </ol>
      <h2 className="mb-4 text-lg font-bold">{STEPS[step].label}</h2>
      {step === 0 ? (
        <BusinessStep key="b" form={form} onSaved={(v) => saved(v)} />
      ) : null}
      {step === 1 ? (
        <OwnerStep key="o" form={form} onSaved={(v) => saved(v)} />
      ) : null}
      {step === 2 ? (
        <TeamStep
          key="t"
          form={form}
          onSaved={(v) => saved(v)}
          onSkip={() => setStep(3)}
        />
      ) : null}
      {step === 3 ? (
        <DocumentsStep
          form={form}
          onChanged={(v) => queryClient.setQueryData(ONBOARDING_KEY, v)}
          onNext={() => setStep(4)}
        />
      ) : null}
      {step === 4 ? (
        <ReviewStep form={form} onEdit={setStep} onSubmitted={submitted} />
      ) : null}
    </Shell>
  );
}

function Shell({ children, rejectionReason }) {
  return (
    <div className="min-h-screen bg-brand-page px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <Link
          to={PATHS.status}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Application
          status
        </Link>
        <h1 className="text-2xl font-bold text-brand-dark">
          Your business application
        </h1>
        {rejectionReason ? (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-brand-maroon/20 bg-[#FCE9E4] p-3 text-sm text-brand-maroon"
          >
            Yulo&apos;s note: {rejectionReason}
          </p>
        ) : null}
        <Card className="mt-6">
          <CardContent className="p-5 sm:p-6">{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
