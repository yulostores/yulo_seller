import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  FileSignature,
  FileText,
  LogOut,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { onboardingApi } from "@/api/seller.api";
import { useSellerAuth } from "@/context/SellerAuthContext";
import { formatDate } from "@/lib/dates";
import { PATHS } from "@/routes/access";

// Where a business that isn't (or is no longer) approved lands: what is happening and what to do.
// GET /seller/status says whether the application has been sent; the session refreshes itself
// while waiting (SellerAuthContext), so approval moves the owner on without a reload.
export default function StatusPage() {
  const { session, logout } = useSellerAuth();
  const status = useQuery({
    queryKey: ["seller-status"],
    queryFn: onboardingApi.status,
    refetchInterval: 60_000,
  });
  const sellerStatus = status.data?.status ?? session?.seller?.status;
  const submittedAt = status.data?.submittedAt ?? null;
  const reason =
    status.data?.rejectionReason ?? session?.seller?.rejectionReason;
  const isOwner = session?.user?.role === "owner";

  let content;
  // "Pending" covers both "not sent yet" and "sent, under review" — only the status call can
  // tell them apart, so don't guess while it is on its way.
  if (sellerStatus === "pending" && status.isLoading) {
    content = {
      icon: Clock,
      title: "Loading your application…",
      text: "",
      action: null,
    };
  } else if (sellerStatus === "pending" && !submittedAt) {
    content = {
      icon: FileText,
      title: "Finish your application",
      text: "Add your business details, the owner's ID and documents, then send them to Yulo for review.",
      action: isOwner
        ? { to: PATHS.onboarding, label: "Continue application" }
        : null,
    };
  } else if (sellerStatus === "pending") {
    content = {
      icon: Clock,
      title: "Your business is under review",
      text: `Sent on ${formatDate(submittedAt)}. Yulo usually reviews applications within two working days. This page moves on by itself once you're approved.`,
      action: isOwner
        ? { to: PATHS.onboarding, label: "View or edit application" }
        : null,
    };
  } else if (sellerStatus === "rejected") {
    content = {
      icon: XCircle,
      title: "Your application needs changes",
      text: reason
        ? `Yulo's note: ${reason}`
        : "Yulo couldn't approve the application as it is.",
      action: isOwner
        ? { to: PATHS.onboarding, label: "Edit and resubmit" }
        : null,
    };
  } else if (sellerStatus === "suspended") {
    content = {
      icon: ShieldAlert,
      title: "This account is suspended",
      text: "Coupons can't be given out or redeemed right now. Please contact Yulo support to resolve this.",
      action: null,
    };
  } else {
    content = {
      icon: Clock,
      title: "Checking your account…",
      text: "",
      action: null,
    };
  }
  const Icon = content.icon;

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-page px-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-6 text-center">
          <Icon
            className="mx-auto h-10 w-10 text-brand-orange"
            aria-hidden="true"
          />
          <h1 className="text-xl font-bold text-brand-dark">{content.title}</h1>
          {content.text ? (
            <p className="text-sm text-muted-foreground">{content.text}</p>
          ) : null}
          {status.isError ? (
            <p
              role="alert"
              className="rounded-lg bg-[#FCE9E4] p-3 text-sm text-brand-maroon"
            >
              Couldn&apos;t check the latest state of your application.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => status.refetch()}
              >
                Try again
              </button>
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {session?.seller?.businessName}
          </p>
          <div className="flex flex-col gap-2 pt-2">
            {content.action ? (
              <Button asChild>
                <Link to={content.action.to}>{content.action.label}</Link>
              </Button>
            ) : null}
            {isOwner && sellerStatus !== "suspended" ? (
              <Button asChild variant="outline">
                <Link to={PATHS.agreement}>
                  <FileSignature aria-hidden="true" /> Partner agreement
                </Link>
              </Button>
            ) : null}
            <Button variant="ghost" onClick={logout}>
              <LogOut aria-hidden="true" /> Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
