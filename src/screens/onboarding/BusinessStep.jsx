import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LocateFixed } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/FormError";
import { SelectField, TextField } from "@/components/Field";
import { categoriesApi, onboardingApi } from "@/api/seller.api";
import { errorMessage } from "@/lib/errors";
import { toDateInput } from "@/lib/dates";
import { businessBody, validateBusiness } from "./validate";
import { serverFieldErrors } from "./serverErrors";

const fromForm = (b) => ({
  businessName: b?.businessName ?? "",
  categoryId: b?.categoryId ? String(b.categoryId) : "",
  gstNumber: b?.gstNumber ?? "",
  line1: b?.address?.line1 ?? "",
  line2: b?.address?.line2 ?? "",
  city: b?.address?.city ?? "",
  state: b?.address?.state ?? "",
  pincode: b?.address?.pincode ?? "",
  businessPhone: b?.businessPhone ?? "",
  establishedOn: toDateInput(b?.establishedOn),
  lat: b?.location?.lat ?? "",
  lng: b?.location?.lng ?? "",
});

export function BusinessStep({ form, onSaved }) {
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.list,
    staleTime: 10 * 60_000,
  });
  const [f, setF] = useState(() => fromForm(form.business));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    setF((x) => ({ ...x, [k]: e.target.value }));
    setErrors((x) => ({
      ...x,
      [k]: "",
      ...(k === "lat" || k === "lng" ? { location: "" } : {}),
    }));
  };

  function locate() {
    if (!navigator.geolocation)
      return setErrors((x) => ({
        ...x,
        location: "Location isn't available in this browser",
      }));
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setF((x) => ({
          ...x,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        })),
      () =>
        setErrors((x) => ({
          ...x,
          location:
            "Couldn't get your location — allow it, or type the position",
        })),
    );
  }

  async function submit(e) {
    e.preventDefault();
    const found = validateBusiness(f);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setError("");
    try {
      onSaved(await onboardingApi.saveBusiness(businessBody(f)));
    } catch (err) {
      const fields = serverFieldErrors(err, {
        "address.line1": "line1",
        "address.city": "city",
        "address.state": "state",
        "address.pincode": "pincode",
      });
      if (fields) setErrors(fields);
      else setError(errorMessage(err, "Could not save the business details."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="businessName"
          label="Business name"
          value={f.businessName}
          onChange={set("businessName")}
          error={errors.businessName}
          maxLength={120}
        />
        <SelectField
          id="categoryId"
          label="Category"
          value={f.categoryId}
          onChange={set("categoryId")}
          error={errors.categoryId}
          placeholder={categories.isLoading ? "Loading…" : "Choose a category"}
          options={(categories.data ?? []).map((c) => ({
            value: c._id,
            label: c.name,
          }))}
        />
        <TextField
          id="gstNumber"
          label="GSTIN (optional)"
          value={f.gstNumber}
          onChange={set("gstNumber")}
          error={errors.gstNumber}
          hint="15 characters, e.g. 29ABCDE1234F1Z5"
        />
        <TextField
          id="businessPhone"
          label="Shop phone"
          inputMode="tel"
          value={f.businessPhone}
          onChange={set("businessPhone")}
          error={errors.businessPhone}
        />
        <TextField
          id="establishedOn"
          label="Started on"
          type="date"
          value={f.establishedOn}
          onChange={set("establishedOn")}
          error={errors.establishedOn}
        />
      </div>
      <fieldset className="space-y-4 rounded-xl border p-4">
        <legend className="px-1 text-sm font-semibold">Shop address</legend>
        <TextField
          id="line1"
          label="Address line 1"
          value={f.line1}
          onChange={set("line1")}
          error={errors.line1}
        />
        <TextField
          id="line2"
          label="Address line 2 (optional)"
          value={f.line2}
          onChange={set("line2")}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            id="city"
            label="City"
            value={f.city}
            onChange={set("city")}
            error={errors.city}
          />
          <TextField
            id="state"
            label="State"
            value={f.state}
            onChange={set("state")}
            error={errors.state}
          />
          <TextField
            id="pincode"
            label="Pincode"
            inputMode="numeric"
            maxLength={6}
            value={f.pincode}
            onChange={set("pincode")}
            error={errors.pincode}
          />
        </div>
      </fieldset>
      <fieldset className="space-y-3 rounded-xl border p-4">
        <legend className="px-1 text-sm font-semibold">
          Map position (optional)
        </legend>
        <p className="text-xs text-muted-foreground">
          Customers are matched with partners near the restaurant they order
          from. Without a position your coupons can't be given out.
        </p>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <TextField
            id="lat"
            label="Latitude"
            inputMode="decimal"
            value={f.lat}
            onChange={set("lat")}
          />
          <TextField
            id="lng"
            label="Longitude"
            inputMode="decimal"
            value={f.lng}
            onChange={set("lng")}
          />
          <Button type="button" variant="outline" onClick={locate}>
            <LocateFixed aria-hidden="true" /> Use my location
          </Button>
        </div>
        {errors.location ? (
          <p className="text-xs text-red-600">{errors.location}</p>
        ) : null}
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
