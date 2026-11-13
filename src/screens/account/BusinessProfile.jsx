import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/FormError";
import { TextField } from "@/components/Field";
import { Spinner } from "@/components/Spinner";
import { accountApi } from "@/api/seller.api";
import { useSellerAuth } from "@/context/SellerAuthContext";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/dates";
import { isValidPincode } from "@/lib/kyc";
import { isValidPhone, toPhoneDigits } from "@/lib/phone";

const KEY = ["profile"];

export function validateContact(f) {
  const e = {};
  if (!isValidPhone(toPhoneDigits(f.businessPhone)))
    e.businessPhone = "Enter a valid 10-digit mobile number";
  if (f.line1.trim().length < 3) e.line1 = "Enter the shop address";
  if (f.city.trim().length < 2) e.city = "Enter the city";
  if (f.state.trim().length < 2) e.state = "Enter the state";
  if (!isValidPincode(f.pincode)) e.pincode = "Enter a 6-digit pincode";
  return e;
}

/**
 * The approved business as Yulo has it. Identity numbers are only ever shown masked. Only the
 * contact details (shop phone, address) can be changed here — and only by the owner; anything
 * else goes through Yulo support.
 */
export function BusinessProfile() {
  const { session } = useSellerAuth();
  const isOwner = session?.user?.role === "owner";
  const query = useQuery({ queryKey: KEY, queryFn: accountApi.profile });

  if (query.isLoading) return <Spinner />;
  if (query.isError) {
    return (
      <Card>
        <CardContent className="p-6 text-sm">
          <p role="alert" className="text-red-700">
            {errorMessage(query.error, "Could not load your profile.")}
          </p>
          <Button className="mt-4" onClick={() => query.refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }
  const p = query.data;
  const rows = [
    ["Business name", p.businessName],
    ["Category", p.category?.name],
    ["GSTIN", p.gstNumber],
    ["Started on", p.establishedOn ? formatDate(p.establishedOn) : null],
    ["Owner", p.owner?.name],
    ["Owner PAN", p.owner?.panMasked],
    ["Owner Aadhaar", p.owner?.aadhaarMasked],
    ["Approved on", p.approvedAt ? formatDate(p.approvedAt) : null],
    ["Current plan", p.currentPlan?.plan?.name ?? p.currentPlan?.name],
  ];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Business details{" "}
            <Lock
              className="h-4 w-4 text-muted-foreground"
              aria-label="Read only"
            />
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            To change these, contact Yulo support.
          </p>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            {rows.map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between gap-3 border-b py-1.5"
              >
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium">{v || "—"}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <ContactCard profile={p} canEdit={isOwner} />
    </div>
  );
}

function ContactCard({ profile, canEdit }) {
  const queryClient = useQueryClient();
  const initial = {
    businessPhone: profile.businessPhone ?? "",
    line1: profile.address?.line1 ?? "",
    line2: profile.address?.line2 ?? "",
    city: profile.address?.city ?? "",
    state: profile.address?.state ?? "",
    pincode: profile.address?.pincode ?? "",
  };
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    setF((x) => ({ ...x, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: "" }));
    setNotice("");
  };

  async function save(e) {
    e.preventDefault();
    const found = validateContact(f);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setError("");
    try {
      const updated = await accountApi.updateProfile({
        businessPhone: toPhoneDigits(f.businessPhone),
        address: {
          line1: f.line1.trim(),
          line2: f.line2.trim() || null,
          city: f.city.trim(),
          state: f.state.trim(),
          pincode: f.pincode.trim(),
        },
      });
      queryClient.setQueryData(KEY, updated);
      setNotice("Contact details saved.");
    } catch (err) {
      setError(errorMessage(err, "Could not save the contact details."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact details</CardTitle>
        {!canEdit ? (
          <p className="text-sm text-muted-foreground">
            Only the owner can change these.
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        <form onSubmit={save} noValidate className="space-y-4">
          <fieldset disabled={!canEdit} className="space-y-4">
            <TextField
              id="c-phone"
              label="Shop phone"
              inputMode="tel"
              value={f.businessPhone}
              onChange={set("businessPhone")}
              error={errors.businessPhone}
            />
            <TextField
              id="c-line1"
              label="Address line 1"
              value={f.line1}
              onChange={set("line1")}
              error={errors.line1}
            />
            <TextField
              id="c-line2"
              label="Address line 2 (optional)"
              value={f.line2}
              onChange={set("line2")}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                id="c-city"
                label="City"
                value={f.city}
                onChange={set("city")}
                error={errors.city}
              />
              <TextField
                id="c-state"
                label="State"
                value={f.state}
                onChange={set("state")}
                error={errors.state}
              />
              <TextField
                id="c-pincode"
                label="Pincode"
                inputMode="numeric"
                maxLength={6}
                value={f.pincode}
                onChange={set("pincode")}
                error={errors.pincode}
              />
            </div>
          </fieldset>
          <FormError message={error} />
          {notice ? (
            <p role="status" className="text-sm text-brand-green">
              {notice}
            </p>
          ) : null}
          {canEdit ? (
            <div className="flex justify-end">
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save contact details"}
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
