import { useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/FormError";
import { onboardingApi } from "@/api/seller.api";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/dates";
import { DOCUMENT_TYPES, MISSING_LABELS } from "./validate";

/** Everything at a glance, what's still missing, and Submit. */
export function ReviewStep({ form, onEdit, onSubmitted }) {
  const [missing, setMissing] = useState(form.missing ?? []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const b = form.business ?? {};
  const o = form.owner ?? {};

  async function submit() {
    setBusy(true);
    setError("");
    try {
      onSubmitted(await onboardingApi.submit());
    } catch (err) {
      if (err?.code === "ONBOARDING_INCOMPLETE")
        setMissing(err.details?.missing ?? []);
      else
        setError(
          errorMessage(
            err,
            "Could not send your application. Please try again.",
          ),
        );
      setBusy(false);
    }
  }

  const section = (title, stepIndex, rows) => (
    <section className="rounded-xl border bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => onEdit(stepIndex)}
        >
          Edit
        </Button>
      </div>
      <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 sm:block">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium">{v || "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );

  const address = [
    b.address?.line1,
    b.address?.line2,
    b.address?.city,
    b.address?.state,
    b.address?.pincode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-4">
      {missing.length ? (
        <div
          role="alert"
          className="rounded-xl border border-brand-orange/30 bg-[#FFF3E0] p-4 text-sm"
        >
          <p className="flex items-center gap-2 font-semibold text-brand-orange">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Still
            missing before you can submit
          </p>
          <ul className="mt-2 list-disc pl-6">
            {missing.map((m) => (
              <li key={m}>{MISSING_LABELS(m)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {section("Business", 0, [
        ["Name", b.businessName],
        ["Category", b.category?.name],
        ["GSTIN", b.gstNumber],
        ["Phone", b.businessPhone],
        ["Address", address],
        ["Started on", b.establishedOn ? formatDate(b.establishedOn) : ""],
      ])}
      {section("Owner", 1, [
        ["Name", o.name],
        ["Date of birth", o.dateOfBirth ? formatDate(o.dateOfBirth) : ""],
        ["Mobile", o.phone],
        ["PAN", o.panMasked],
        ["Aadhaar", o.aadhaarMasked],
      ])}
      {section(
        "Team",
        2,
        (form.employees ?? []).length
          ? form.employees.map((e) => [e.name, `${e.role} · ${e.phone}`])
          : [["Team members", "None yet"]],
      )}
      {section(
        "Documents",
        3,
        (form.documents ?? []).length
          ? form.documents.map((d) => [
              DOCUMENT_TYPES[d.type] ?? d.type,
              d.name,
            ])
          : [["Documents", "None uploaded"]],
      )}
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="button" onClick={submit} disabled={busy}>
          {busy
            ? "Sending…"
            : form.status === "rejected"
              ? "Resubmit for review"
              : form.submittedAt
                ? "Update my application"
                : "Submit for review"}
        </Button>
      </div>
    </div>
  );
}
