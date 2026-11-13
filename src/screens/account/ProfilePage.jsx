import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { cn } from "@/lib/utils";
import { useSellerAuth } from "@/context/SellerAuthContext";
import { PasswordCard } from "./PasswordCard";
import { BusinessProfile } from "./BusinessProfile";
import { TeamPanel } from "./TeamPanel";

const TABS = [
  { key: "business", label: "Business" },
  { key: "team", label: "Team" },
];

/** Profile: the business (contact details editable), the owner's sign-in password, and the Team tab. */
export default function ProfilePage() {
  const [params, setParams] = useSearchParams();
  const { session } = useSellerAuth();
  const isOwner = session?.user?.role === "owner";
  const initial = TABS.some((t) => t.key === params.get("tab"))
    ? params.get("tab")
    : "business";
  const [tab, setTab] = useState(initial);
  const choose = (key) => {
    setTab(key);
    setParams(key === "business" ? {} : { tab: key }, { replace: true });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 text-2xl font-bold text-brand-dark">Profile</h1>
      <div
        role="tablist"
        aria-label="Profile sections"
        className="mb-5 inline-flex rounded-xl border bg-white p-1"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => choose(t.key)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium",
              tab === t.key
                ? "bg-primary text-white"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="space-y-5">
        {tab === "business" ? (
          <>
            <BusinessProfile />
            {isOwner ? <PasswordCard /> : null}
          </>
        ) : (
          <TeamPanel />
        )}
      </div>
    </div>
  );
}
