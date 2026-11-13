import { Navigate, Outlet, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { FullPageSpinner } from "@/components/Spinner";
import { useSellerAuth } from "@/context/SellerAuthContext";
import { canVisit, homeFor } from "./access";

/**
 * Renders the matched screen only if this session may open it (routes/access.js); otherwise sends
 * the person to their own home screen — the login screen when signed out.
 */
export function RequireAccess() {
  const { session, state, retryRestore } = useSellerAuth();
  const location = useLocation();

  if (state === "loading") return <FullPageSpinner label="Signing you in…" />;
  if (state === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-brand-page px-6 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">
          We couldn&apos;t reach Yulo to restore your session. Check your
          connection.
        </p>
        <Button onClick={retryRestore}>Try again</Button>
      </div>
    );
  }
  if (!canVisit(session, location.pathname))
    return <Navigate to={homeFor(session)} replace />;
  return <Outlet />;
}

/** "/" and unknown paths: wherever this session starts. */
export function HomeRedirect() {
  const { session, state } = useSellerAuth();
  if (state === "loading") return <FullPageSpinner label="Signing you in…" />;
  return <Navigate to={homeFor(session)} replace />;
}
