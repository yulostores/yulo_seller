import { useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/FormError";
import { TextField } from "@/components/Field";
import { onboardingApi } from "@/api/seller.api";
import { errorMessage } from "@/lib/errors";
import { toDateInput } from "@/lib/dates";
import { ownerBody, validateOwner } from "./validate";
import { serverFieldErrors } from "./serverErrors";

/**
 * The owner's details. PAN and Aadhaar are typed once: after saving, only their masked form comes
 * back (the server never returns the numbers), the inputs stay empty, and leaving them empty
 * keeps what is on file.
 */
export function OwnerStep({ form, onSaved }) {
  const saved = {
    panMasked: form.owner?.panMasked ?? null,
    aadhaarMasked: form.owner?.aadhaarMasked ?? null,
  };
  const [f, setF] = useState(() => ({
    name: form.owner?.name ?? "",
    dateOfBirth: toDateInput(form.owner?.dateOfBirth),
    phone: form.owner?.phone ?? "",
    pan: "",
    aadhaar: "",
  }));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    setF((x) => ({ ...x, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: "" }));
  };

  async function submit(e) {
    e.preventDefault();
    const found = validateOwner(f, saved);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setError("");
    try {
      const view = await onboardingApi.saveOwner(ownerBody(f));
      setF((x) => ({ ...x, pan: "", aadhaar: "" })); // never kept on screen once saved
      onSaved(view);
    } catch (err) {
      const fields = serverFieldErrors(err);
      if (fields) setErrors(fields);
      else setError(errorMessage(err, "Could not save the owner details."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="ownerName"
          label="Owner name"
          value={f.name}
          onChange={set("name")}
          error={errors.name}
          autoComplete="name"
        />
        <TextField
          id="ownerDob"
          label="Date of birth"
          type="date"
          value={f.dateOfBirth}
          onChange={set("dateOfBirth")}
          error={errors.dateOfBirth}
          hint="The owner must be 18 or older"
        />
        <TextField
          id="ownerPhone"
          label="Owner mobile"
          inputMode="tel"
          value={f.phone}
          onChange={set("phone")}
          error={errors.phone}
        />
      </div>
      <fieldset className="space-y-4 rounded-xl border p-4">
        <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold">
          <ShieldCheck
            className="h-4 w-4 text-brand-green"
            aria-hidden="true"
          />{" "}
          Identity
        </legend>
        <p className="text-xs text-muted-foreground">
          Stored securely: PAN encrypted, Aadhaar as its last 4 digits only.
          Once saved they are only ever shown masked.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="pan"
            label="PAN"
            autoComplete="off"
            value={f.pan}
            onChange={set("pan")}
            error={errors.pan}
            placeholder={saved.panMasked ?? "ABCDE1234F"}
            hint={
              saved.panMasked
                ? `On file: ${saved.panMasked} — leave blank to keep it`
                : undefined
            }
          />
          <TextField
            id="aadhaar"
            label="Aadhaar number"
            autoComplete="off"
            inputMode="numeric"
            value={f.aadhaar}
            onChange={set("aadhaar")}
            error={errors.aadhaar}
            placeholder={saved.aadhaarMasked ?? "1234 5678 9012"}
            hint={
              saved.aadhaarMasked
                ? `On file: ${saved.aadhaarMasked} — leave blank to keep it`
                : undefined
            }
          />
        </div>
      </fieldset>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save and continue"}
        </Button>
      </div>
    </form>
  );
}
