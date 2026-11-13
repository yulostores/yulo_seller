import { Loader2 } from "lucide-react";

export function Spinner({ label = "Loading…", className = "" }) {
  return (
    <div
      role="status"
      className={`flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground ${className}`}
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function FullPageSpinner({ label }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-page">
      <Spinner label={label} />
    </div>
  );
}
