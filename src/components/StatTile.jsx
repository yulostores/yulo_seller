// A headline number: label, value, optional note (stat-tile contract from the dataviz skill).
export function StatTile({ label, value, note, testId }) {
  return (
    <div
      className="rounded-2xl border bg-white p-4 shadow-sm"
      data-testid={testId}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-brand-dark">
        {value}
      </p>
      {note ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
      ) : null}
    </div>
  );
}

export const formatCount = (n) =>
  Number.isFinite(n) ? n.toLocaleString("en-IN") : "—";
export const formatRate = (n) => (Number.isFinite(n) ? `${n}%` : "—");
