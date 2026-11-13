import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/Spinner";
import { errorMessage } from "@/lib/errors";

/** Loading / error-with-retry for a query; renders children(data) once it has data. */
export function LoadState({
  query,
  children,
  errorText = "Could not load this.",
}) {
  if (query.isLoading) return <Spinner />;
  if (query.isError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-brand-maroon/20 bg-[#FCE9E4] p-4 text-sm text-brand-maroon"
      >
        <p>{errorMessage(query.error, errorText)}</p>
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() => query.refetch()}
        >
          Try again
        </Button>
      </div>
    );
  }
  return children(query.data);
}
