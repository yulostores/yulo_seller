import { MAGNITUDE } from "./palette";

/**
 * Parts of a whole compared with each other: one bar per part on a shared baseline, one hue, the
 * value at the tip (dataviz: ranked horizontal bars). `sort` ranks them largest first; leave it off
 * for an ordered scale (age bands keep their order). Plain HTML, so it is readable as text too.
 */
export function BarList({ items, sort = false, label }) {
  const rows = sort ? [...items].sort((a, b) => b.value - a.value) : items;
  const total = rows.reduce((n, r) => n + r.value, 0);
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (total === 0)
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        No customers in this period yet.
      </p>
    );
  return (
    <ul className="space-y-2.5" aria-label={label}>
      {rows.map((r) => {
        const share = Math.round((r.value / total) * 100);
        return (
          <li
            key={r.key}
            className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-3 text-sm"
            data-testid={`bar-${r.key}`}
          >
            <span className="truncate text-muted-foreground">{r.label}</span>
            <span className="h-3 overflow-hidden rounded-r bg-secondary/60">
              <span
                className="block h-full rounded-r"
                style={{
                  width: `${(r.value / max) * 100}%`,
                  maxWidth: "100%",
                  background: MAGNITUDE,
                }}
              />
            </span>
            <span className="text-right tabular-nums">
              {r.value.toLocaleString("en-IN")}{" "}
              <span className="text-xs text-muted-foreground">({share}%)</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
