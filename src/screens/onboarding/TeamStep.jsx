import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/FormError";
import { GENDER_OPTIONS, SelectField, TextField } from "@/components/Field";
import { onboardingApi } from "@/api/seller.api";
import { errorMessage } from "@/lib/errors";
import { toDateInput } from "@/lib/dates";
import { memberBody, STAFF_ROLES, validateTeam } from "./validate";

const blank = () => ({
  name: "",
  phone: "",
  role: "employee",
  dateOfBirth: "",
  gender: "",
  experienceYears: "",
});
const fromServer = (u) => ({
  name: u.name ?? "",
  phone: u.phone ?? "",
  role: u.role ?? "employee",
  dateOfBirth: toDateInput(u.dateOfBirth),
  gender: u.gender ?? "",
  experienceYears: u.experienceYears ?? "",
});

/** Managers and employees who will sign in (optional — can be added later from Profile → Team). */
export function TeamStep({ form, onSaved, onSkip }) {
  const [rows, setRows] = useState(() =>
    (form.employees ?? []).map(fromServer),
  );
  const [errors, setErrors] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (i, k) => (e) => {
    const value = e.target.value;
    setRows((list) => list.map((r, j) => (j === i ? { ...r, [k]: value } : r)));
    setErrors((list) => list.map((x, j) => (j === i ? { ...x, [k]: "" } : x)));
  };

  async function submit(e) {
    e.preventDefault();
    const found = validateTeam(rows, form.owner?.phone);
    setErrors(found);
    if (found.some((x) => Object.keys(x).length)) return;
    setBusy(true);
    setError("");
    try {
      onSaved(await onboardingApi.saveEmployees(rows.map(memberBody)));
    } catch (err) {
      const dupes = err?.details?.duplicatePhones;
      setError(
        dupes?.length
          ? `Each person needs their own number (repeated: ${dupes.join(", ")})`
          : errorMessage(err, "Could not save the team."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Everyone who will sign in to redeem coupons. Each person signs in with
        their own mobile number. You can skip this and add people later.
      </p>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No team members yet.
        </p>
      ) : null}
      {rows.map((r, i) => (
        <fieldset
          key={i}
          className="space-y-4 rounded-xl border p-4"
          aria-label={`Team member ${i + 1}`}
        >
          <div className="flex items-center justify-between">
            <legend className="text-sm font-semibold">
              Team member {i + 1}
            </legend>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setRows((l) => l.filter((_, j) => j !== i));
                setErrors((l) => l.filter((_, j) => j !== i));
              }}
            >
              <Trash2 aria-hidden="true" /> Remove
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              id={`m${i}-name`}
              label="Name"
              value={r.name}
              onChange={update(i, "name")}
              error={errors[i]?.name}
            />
            <TextField
              id={`m${i}-phone`}
              label="Mobile"
              inputMode="tel"
              value={r.phone}
              onChange={update(i, "phone")}
              error={errors[i]?.phone}
            />
            <SelectField
              id={`m${i}-role`}
              label="Role"
              value={r.role}
              onChange={update(i, "role")}
              error={errors[i]?.role}
              options={STAFF_ROLES}
            />
            <TextField
              id={`m${i}-dob`}
              label="Date of birth (optional)"
              type="date"
              value={r.dateOfBirth}
              onChange={update(i, "dateOfBirth")}
              error={errors[i]?.dateOfBirth}
            />
            <SelectField
              id={`m${i}-gender`}
              label="Gender (optional)"
              value={r.gender}
              onChange={update(i, "gender")}
              options={GENDER_OPTIONS}
              placeholder="—"
            />
            <TextField
              id={`m${i}-exp`}
              label="Experience, years (optional)"
              type="number"
              min={0}
              max={80}
              value={r.experienceYears}
              onChange={update(i, "experienceYears")}
              error={errors[i]?.experienceYears}
            />
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setRows((l) => [...l, blank()]);
          setErrors((l) => [...l, {}]);
        }}
      >
        <Plus aria-hidden="true" /> Add a person
      </Button>
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        {rows.length === 0 && (form.employees ?? []).length === 0 ? (
          <Button type="button" variant="ghost" onClick={onSkip}>
            Skip for now
          </Button>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save and continue"}
        </Button>
      </div>
    </form>
  );
}
