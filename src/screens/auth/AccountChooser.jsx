import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { FormError } from "@/components/FormError";
import { useSellerAuth } from "@/context/SellerAuthContext";
import { errorMessage } from "@/lib/errors";
import { ROLE_LABELS } from "@/routes/access";

const STATUS_LABELS = {
  pending: "Under review",
  active: "Active",
  rejected: "Not approved",
  suspended: "Suspended",
};

/** One number with logins at several businesses: pick one. */
export function AccountChooser({ selectToken, accounts, onSelected }) {
  const { selectAccount } = useSellerAuth();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  async function choose(account) {
    setBusyId(account.sellerUserId);
    setError("");
    try {
      await selectAccount(selectToken, account.sellerUserId);
      onSelected();
    } catch (err) {
      setError(
        errorMessage(
          err,
          "Could not open that business. Please sign in again.",
        ),
      );
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        This number works at more than one business. Which one do you want to
        open?
      </p>
      <ul className="space-y-2">
        {accounts.map((a) => (
          <li key={a.sellerUserId}>
            <button
              type="button"
              disabled={Boolean(busyId)}
              onClick={() => choose(a)}
              className="flex w-full items-center gap-3 rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition hover:border-primary disabled:opacity-60"
            >
              <span className="flex-1">
                <span className="block font-semibold">{a.businessName}</span>
                <span className="mt-1 flex gap-1.5">
                  <Badge variant="muted">{ROLE_LABELS[a.role] ?? a.role}</Badge>
                  <Badge variant={a.sellerStatus === "active" ? "ok" : "warn"}>
                    {STATUS_LABELS[a.sellerStatus] ?? a.sellerStatus}
                  </Badge>
                </span>
              </span>
              <ChevronRight
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
            </button>
          </li>
        ))}
      </ul>
      <FormError message={error} />
    </div>
  );
}
