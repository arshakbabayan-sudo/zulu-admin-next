"use client";

/**
 * Shared mini horizontal-bar list (the my-profile mock's `.mini-list`):
 * used by My agents (top destinations / by service) and the My-team employee
 * detail. Bar widths are relative to the largest row so the top item is
 * always 100%.
 */
export function MiniBars({ rows, empty }: { rows: { name: string; val: number }[]; empty: string }) {
  if (rows.length === 0) return <span className="cell-muted">{empty}</span>;
  const max = Math.max(...rows.map((r) => r.val), 1);
  return (
    <div className="mini-list">
      {rows.map((r) => (
        <div className="mini-row" key={r.name}>
          <span className="mr-name">{r.name}</span>
          <span className="mr-track"><span style={{ width: `${Math.round((r.val / max) * 100)}%` }} /></span>
          <span className="mr-val">{r.val}</span>
        </div>
      ))}
    </div>
  );
}
