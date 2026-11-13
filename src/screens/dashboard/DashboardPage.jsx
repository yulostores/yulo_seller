import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Ticket } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadState } from "@/components/LoadState";
import { formatCount, formatRate, StatTile } from "@/components/StatTile";
import { CouponTable } from "@/components/CouponRows";
import { TrendChart } from "@/components/charts/TrendChart";
import { reportsApi } from "@/api/seller.api";
import { PATHS } from "@/routes/access";
import { planHeading } from "@/lib/plans";

/** Dashboard: the plan, the headline numbers, the last 30 days' trend, the latest coupons. */
export default function DashboardPage() {
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: reportsApi.dashboard,
  });
  const trend = useQuery({
    queryKey: ["trends", { interval: "day" }],
    queryFn: () => reportsApi.trends({ interval: "day" }),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-2xl font-bold text-brand-dark">Dashboard</h1>
      <LoadState query={dashboard} errorText="Could not load your dashboard.">
        {(d) => (
          <>
            <PlanTile
              plan={d.currentPlan}
              activePlans={d.activePlans}
              stock={d.stock}
            />
            <section
              aria-label="Coupon numbers"
              className="grid grid-cols-2 gap-3 md:grid-cols-5"
            >
              <StatTile
                testId="tile-issued"
                label="Issued"
                value={formatCount(d.coupons.issued)}
                note="to customers"
              />
              <StatTile
                testId="tile-pending"
                label="Pending"
                value={formatCount(d.stock.pending)}
                note="still to give out"
              />
              <StatTile
                testId="tile-redeemed"
                label="Redeemed"
                value={formatCount(d.coupons.redeemed)}
              />
              <StatTile
                testId="tile-expired"
                label="Expired"
                value={formatCount(d.coupons.expired)}
              />
              <StatTile
                testId="tile-rate"
                label="Redemption rate"
                value={formatRate(d.coupons.redemptionRate)}
                note="redeemed ÷ issued"
              />
            </section>
          </>
        )}
      </LoadState>

      <Card>
        <CardHeader>
          <CardTitle>Issued vs redeemed — last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadState query={trend} errorText="Could not load the trend.">
            {(t) => <TrendChart series={t.series} interval="day" />}
          </LoadState>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Recent coupons</CardTitle>
          <Link
            to={PATHS.reports}
            className="text-sm font-medium text-primary hover:underline"
          >
            All coupons
          </Link>
        </CardHeader>
        <CardContent>
          <LoadState query={dashboard}>
            {(d) =>
              d.recentCoupons.length ? (
                <CouponTable
                  rows={d.recentCoupons}
                  columns={[
                    "customer",
                    "offer",
                    "issuedAt",
                    "expiresAt",
                    "status",
                  ]}
                  caption="Recent coupons"
                />
              ) : (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No coupons yet. They appear here as customers receive them.
                </p>
              )
            }
          </LoadState>
        </CardContent>
      </Card>
    </div>
  );
}

function PlanTile({ plan, activePlans, stock }) {
  if (!plan) {
    return (
      <Card data-testid="plan-tile">
        <CardContent className="flex flex-wrap items-center gap-3 p-5 text-sm">
          <Ticket className="h-5 w-5 text-brand-orange" aria-hidden="true" />
          <span className="flex-1">
            No plan yet — customers can&apos;t receive your coupons until you
            have one.
          </span>
          <Link
            to={PATHS.plans}
            className="font-semibold text-primary hover:underline"
          >
            See plans
          </Link>
        </CardContent>
      </Card>
    );
  }
  const used = stock.allocated
    ? Math.min(100, Math.round((stock.issued / stock.allocated) * 100))
    : 0;
  return (
    <Card data-testid="plan-tile">
      <CardContent className="flex flex-wrap items-center gap-4 p-5">
        <Ticket className="h-6 w-6 text-brand-orange" aria-hidden="true" />
        <div className="min-w-[10rem] flex-1">
          <div className="font-semibold">
            {planHeading(activePlans, plan)}{" "}
            <Badge
              className="ml-1"
              variant={plan.status === "active" ? "ok" : "muted"}
            >
              {plan.status === "active" ? "Active" : "Used up"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatCount(stock.issued)} of {formatCount(stock.allocated)}{" "}
            coupons given out · {formatCount(stock.pending)} left
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Coupons given out"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={used}
          className="h-2.5 w-full overflow-hidden rounded-full bg-secondary sm:w-48"
        >
          <div
            className="h-full rounded-full bg-brand-gradient"
            style={{ width: `${used}%` }}
          />
        </div>
        <Link
          to={PATHS.plans}
          className="text-sm font-medium text-primary hover:underline"
        >
          Plans
        </Link>
      </CardContent>
    </Card>
  );
}
