import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/FormError";
import { TextField } from "@/components/Field";
import { Label } from "@/components/ui/label";
import { LoadState } from "@/components/LoadState";
import { offersApi } from "@/api/seller.api";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/dates";

const KEY = ["offers"];

export const OFFER_STATUS = {
  draft: ["Draft", "muted"],
  pending_review: ["In review", "warn"],
  approved: ["Live", "ok"],
  paused: ["Paused", "info"],
  rejected: ["Changes needed", "danger"],
};

/** The offer form's rules — the server's (couponOffer.service.js offerFields). */
export function validateOffer(f) {
  const e = {};
  const title = f.title.trim();
  if (title.length < 3) e.title = "Give the offer a short title";
  else if (title.length > 120) e.title = "At most 120 characters";
  if (f.terms.trim().length > 2000) e.terms = "At most 2,000 characters";
  if (f.validityDays !== "") {
    const n = Number(f.validityDays);
    if (!Number.isInteger(n) || n < 1 || n > 365)
      e.validityDays = "Whole days from 1 to 365";
  }
  return e;
}

export const offerBody = (f) => ({
  title: f.title.trim(),
  terms: f.terms.trim(),
  validityDays: f.validityDays === "" ? null : Number(f.validityDays),
});

/**
 * Offers: what a coupon gives the customer. Written here, approved by Yulo before customers
 * receive it. Editing a live or paused offer sends it back to review.
 */
export default function OffersPage() {
  const queryClient = useQueryClient();
  const offers = useQuery({ queryKey: KEY, queryFn: offersApi.list });
  const [editing, setEditing] = useState(null); // null | 'new' | offer

  const replace = (offer) =>
    queryClient.setQueryData(KEY, (list = []) =>
      list.some((o) => o._id === offer._id)
        ? list.map((o) => (o._id === offer._id ? offer : o))
        : [offer, ...list],
    );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand-dark">Offers</h1>
        {editing === null ? (
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden="true" /> New offer
          </Button>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        Customers get your live offer as a coupon after ordering food on Yulo.
        Every new or changed offer is checked by Yulo before customers see it.
      </p>

      {editing !== null ? (
        <OfferForm
          offer={editing === "new" ? null : editing}
          onSaved={(offer) => {
            replace(offer);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      <LoadState query={offers} errorText="Could not load your offers.">
        {(list) =>
          list.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No offers yet. Create one to start reaching customers.
            </p>
          ) : (
            <ul className="space-y-3">
              {list.map((o) => (
                <OfferCard
                  key={o._id}
                  offer={o}
                  onEdit={() => setEditing(o)}
                  onChanged={replace}
                />
              ))}
            </ul>
          )
        }
      </LoadState>
    </div>
  );
}

function OfferCard({ offer, onEdit, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [label, variant] = OFFER_STATUS[offer.status] ?? [
    offer.status,
    "muted",
  ];

  const act = (fn) => async () => {
    setBusy(true);
    setError("");
    try {
      onChanged(await fn(offer._id));
    } catch (err) {
      setError(errorMessage(err, "Could not update the offer."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li
      className="rounded-2xl border bg-white p-4 shadow-sm"
      data-testid={`offer-${offer._id}`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{offer.title}</p>
          {offer.terms ? (
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {offer.terms}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {offer.validityDays
              ? `Valid ${offer.validityDays} days from when the customer gets it`
              : "Valid for the standard period"}{" "}
            · updated {formatDate(offer.updatedAt)}
          </p>
        </div>
        <Badge variant={variant}>{label}</Badge>
      </div>
      {offer.status === "rejected" && offer.rejectionReason ? (
        <p className="mt-3 rounded-lg bg-[#FCE9E4] p-2.5 text-sm text-brand-maroon">
          Yulo&apos;s note: {offer.rejectionReason}
        </p>
      ) : null}
      {offer.status === "pending_review" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Yulo is checking this offer. It goes live once approved.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onEdit} disabled={busy}>
          <Pencil aria-hidden="true" /> Edit
        </Button>
        {offer.status === "draft" || offer.status === "rejected" ? (
          <Button size="sm" onClick={act(offersApi.submit)} disabled={busy}>
            Submit for review
          </Button>
        ) : null}
        {offer.status === "approved" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={act(offersApi.pause)}
            disabled={busy}
          >
            Pause
          </Button>
        ) : null}
        {offer.status === "paused" ? (
          <Button size="sm" onClick={act(offersApi.resume)} disabled={busy}>
            Resume
          </Button>
        ) : null}
      </div>
      <FormError message={error} />
    </li>
  );
}

function OfferForm({ offer, onSaved, onCancel }) {
  const [f, setF] = useState({
    title: offer?.title ?? "",
    terms: offer?.terms ?? "",
    validityDays: offer?.validityDays ?? "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const live =
    offer && (offer.status === "approved" || offer.status === "paused");
  const set = (k) => (e) => {
    setF((x) => ({ ...x, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: "" }));
  };

  async function save(e) {
    e.preventDefault();
    const found = validateOffer(f);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setError("");
    try {
      onSaved(
        offer
          ? await offersApi.update(offer._id, offerBody(f))
          : await offersApi.create(offerBody(f)),
      );
    } catch (err) {
      setError(errorMessage(err, "Could not save the offer."));
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{offer ? "Edit offer" : "New offer"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} noValidate className="space-y-4">
          <TextField
            id="offer-title"
            label="Title"
            placeholder="20% off any haircut"
            value={f.title}
            onChange={set("title")}
            error={errors.title}
            maxLength={120}
          />
          <div>
            <Label htmlFor="offer-terms">Terms (optional)</Label>
            <textarea
              id="offer-terms"
              rows={4}
              maxLength={2000}
              value={f.terms}
              onChange={set("terms")}
              placeholder="Weekdays only. One coupon per visit."
              className="mt-2 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {errors.terms ? (
              <p className="mt-1.5 text-xs text-red-600">{errors.terms}</p>
            ) : null}
          </div>
          <TextField
            id="offer-validity"
            label="Valid for (days, optional)"
            type="number"
            min={1}
            max={365}
            value={f.validityDays}
            onChange={set("validityDays")}
            error={errors.validityDays}
            hint="Leave blank for Yulo's standard validity."
            className="max-w-xs"
          />
          {live ? (
            <p
              role="note"
              className="rounded-lg bg-[#FFF3E0] p-3 text-sm text-[#8a3a0a]"
            >
              Saving changes sends this offer back to Yulo for review. Customers
              won&apos;t get it until it&apos;s approved again.
            </p>
          ) : null}
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : offer ? "Save changes" : "Save as draft"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
