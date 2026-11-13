import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadState } from "@/components/LoadState";
import { FormError } from "@/components/FormError";
import { formatCount, formatRate, StatTile } from "@/components/StatTile";
import {
  AGE_BAND_LABELS,
  COUPON_STATUS,
  CouponTable,
  GENDER_LABELS,
} from "@/components/CouponRows";
import { BarList } from "@/components/charts/BarList";
import { TrendChart } from "@/components/charts/TrendChart";
import { reportsApi } from "@/api/seller.api";
import { errorMessage } from "@/lib/errors";

const PAGE_SIZE = 25;
const AGE_ORDER = [
  "under-18",
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55+",
  "not-given",
];
const GENDER_ORDER = ["female", "male", "other", "not_given"];

const today = () => new Date().toISOString().slice(0, 10);

/** Report filters → the API's query (and the CSV's). Blank values are left out. */
export function reportQuery({ from, to, status }) {
  const q = {};
  if (from) q.from = from;
  if (to) q.to = to;
  if (status) q.status = status;
  return q;
}

/**
 * Reports: one row of filters (date range, status) drives everything below — the gender split,
 * age bands, the issued-vs-redeemed chart and the customer table (and the CSV). Customers appear
 * as a masked name, gender and age band; never a phone number.
 */
export default function ReportsPage() {
  const [draft, setDraft] = useState({ from: "", to: "", status: "" });
  const [filters, setFilters] = useState({ from: "", to: "", status: "" });
  const [interval, setTrendInterval] = useState("day");
  const [page, setPage] = useState(1);
  const [filterError, setFilterError] = useState("");
  const [csv, setCsv] = useState({ busy: false, error: "" });
  const q = reportQuery(filters);

  const demographics = useQuery({
    queryKey: ["demographics", q],
    queryFn: () => reportsApi.demographics(q),
  });
  const trends = useQuery({
    queryKey: ["trends", { ...q, interval }],
    queryFn: () => reportsApi.trends({ ...q, interval }),
  });
  const coupons = useQuery({
    queryKey: ["report-coupons", q, page],
    queryFn: () => reportsApi.coupons({ ...q, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  function apply(e) {
    e.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to)
      return setFilterError("The start date is after the end date.");
    setFilterError("");
    setFilters(draft);
    setPage(1);
  }

  async function downloadCsv() {
    setCsv({ busy: true, error: "" });
    try {
      const blob = await reportsApi.couponsCsv(q);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `coupons${q.from ? `-from-${q.from}` : ""}${q.to ? `-to-${q.to}` : ""}${q.status ? `-${q.status}` : ""}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setCsv({ busy: false, error: "" });
    } catch (err) {
      setCsv({
        busy: false,
        error: errorMessage(err, "Could not download the file."),
      });
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-2xl font-bold text-brand-dark">Reports</h1>

      <form
        onSubmit={apply}
        className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4"
        aria-label="Report filters"
      >
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">From</span>
          <input
            type="date"
            max={today()}
            value={draft.from}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            className="h-10 rounded-lg border px-3"
            aria-label="From"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">To</span>
          <input
            type="date"
            max={today()}
            value={draft.to}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            className="h-10 rounded-lg border px-3"
            aria-label="To"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Status</span>
          <select
            value={draft.status}
            onChange={(e) =>
              setDraft((d) => ({ ...d, status: e.target.value }))
            }
            className="h-10 rounded-lg border bg-white px-3"
            aria-label="Status"
          >
            <option value="">All</option>
            {Object.entries(COUPON_STATUS).map(([key, [label]]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">Apply</Button>
        {filters.from || filters.to || filters.status ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              const clear = { from: "", to: "", status: "" };
              setDraft(clear);
              setFilters(clear);
              setPage(1);
            }}
          >
            Clear
          </Button>
        ) : null}
        <span className="flex-1" />
        <Button
          type="button"
          variant="outline"
          onClick={downloadCsv}
          disabled={csv.busy}
        >
          <Download aria-hidden="true" />{" "}
          {csv.busy ? "Preparing…" : "Download CSV"}
        </Button>
        {filterError ? (
          <p className="basis-full text-sm text-red-600">{filterError}</p>
        ) : null}
      </form>
      <FormError message={csv.error} />

      <LoadState query={demographics} errorText="Could not load the report.">
        {(d) => (
          <>
            <section
              aria-label="Totals"
              className="grid grid-cols-2 gap-3 md:grid-cols-4"
            >
              <StatTile
                testId="r-issued"
                label="Issued"
                value={formatCount(d.counts.issued)}
              />
              <StatTile
                testId="r-redeemed"
                label="Redeemed"
                value={formatCount(d.counts.redeemed)}
              />
              <StatTile
                testId="r-expired"
                label="Expired"
                value={formatCount(d.counts.expired)}
              />
              <StatTile
                testId="r-rate"
                label="Redemption rate"
                value={formatRate(d.counts.redemptionRate)}
              />
            </section>
            <div className="grid gap-5 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Gender</CardTitle>
                </CardHeader>
                <CardContent>
                  <BarList
                    label="Customers by gender"
                    sort
                    items={GENDER_ORDER.map((k) => ({
                      key: k,
                      label: GENDER_LABELS[k] ?? "Not given",
                      value: d.gender[k] ?? 0,
                    }))}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Age</CardTitle>
                </CardHeader>
                <CardContent>
                  <BarList
                    label="Customers by age band"
                    items={AGE_ORDER.map((k) => ({
                      key: k,
                      label: AGE_BAND_LABELS[k],
                      value: d.ageBands[k] ?? 0,
                    }))}
                  />
                  <p className="mt-3 text-xs text-muted-foreground">
                    Age on the day the coupon was issued.
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </LoadState>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Issued vs redeemed</CardTitle>
          <div
            role="group"
            aria-label="Interval"
            className="inline-flex rounded-lg border bg-white p-0.5 text-xs"
          >
            {["day", "week", "month"].map((i) => (
              <button
                key={i}
                type="button"
                aria-pressed={interval === i}
                onClick={() => setTrendInterval(i)}
                className={`rounded-md px-3 py-1 ${interval === i ? "bg-primary text-white" : "text-muted-foreground"}`}
              >
                {i === "day" ? "Daily" : i === "week" ? "Weekly" : "Monthly"}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <LoadState query={trends} errorText="Could not load the chart.">
            {(t) => <TrendChart series={t.series} interval={t.interval} />}
          </LoadState>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <LoadState query={coupons} errorText="Could not load the customers.">
            {(c) =>
              c.total === 0 ? (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No coupons match these filters.
                </p>
              ) : (
                <>
                  <CouponTable
                    rows={c.coupons}
                    columns={[
                      "customer",
                      "ageBand",
                      "gender",
                      "issuedAt",
                      "expiresAt",
                      "status",
                    ]}
                    caption="Customers"
                  />
                  <Pager
                    page={c.page}
                    total={c.total}
                    limit={c.limit}
                    onPage={setPage}
                  />
                </>
              )
            }
          </LoadState>
        </CardContent>
      </Card>
    </div>
  );
}

function Pager({ page, total, limit, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const first = (page - 1) * limit + 1;
  const last = Math.min(total, page * limit);
  return (
    <nav
      aria-label="Pages"
      className="flex items-center justify-between text-sm"
    >
      <span className="text-muted-foreground">
        {first}–{last} of {total.toLocaleString("en-IN")}
      </span>
      <span className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </span>
    </nav>
  );
}
