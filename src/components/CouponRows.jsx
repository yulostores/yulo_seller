import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";

// The seller's coupon rows (toSellerCouponView on the server): masked name, gender, age band —
// never a phone number or customer id.
export const COUPON_STATUS = {
  issued: ["Active", "ok"],
  redeemed: ["Redeemed", "info"],
  expired: ["Expired", "muted"],
  void: ["Void", "danger"],
};
export const GENDER_LABELS = { male: "Male", female: "Female", other: "Other" };
export const AGE_BAND_LABELS = {
  "under-18": "Under 18",
  "18-24": "18–24",
  "25-34": "25–34",
  "35-44": "35–44",
  "45-54": "45–54",
  "55+": "55+",
  "not-given": "Not given",
};

export function StatusBadge({ status }) {
  const [text, variant] = COUPON_STATUS[status] ?? [status, "muted"];
  return <Badge variant={variant}>{text}</Badge>;
}

/** columns: which of 'customer', 'ageBand', 'gender', 'offer', 'issuedAt', 'expiresAt', 'status', 'redeemed' to show. */
export function CouponTable({ rows, columns, caption }) {
  const cols = {
    customer: ["Customer", (r) => r.customerName ?? "—"],
    ageBand: ["Age", (r) => AGE_BAND_LABELS[r.ageBand] ?? r.ageBand],
    gender: ["Gender", (r) => GENDER_LABELS[r.gender] ?? "—"],
    offer: ["Offer", (r) => r.offerTitle ?? "—"],
    issuedAt: ["Issued", (r) => formatDate(r.issuedAt)],
    expiresAt: ["Expires", (r) => formatDate(r.expiresAt)],
    status: ["Status", (r) => <StatusBadge status={r.status} />],
    redeemed: [
      "Redeemed",
      (r) =>
        r.redeemedAt
          ? `${formatDate(r.redeemedAt)}${r.redeemedByName ? ` · ${r.redeemedByName}` : ""}`
          : "—",
    ],
  };
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            {columns.map((c) => (
              <th key={c} className="whitespace-nowrap px-4 py-2.5">
                {cols[c][0]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.id}>
              {columns.map((c) => (
                <td key={c} className="whitespace-nowrap px-4 py-2.5">
                  {cols[c][1](r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
