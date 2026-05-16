import { useReconcileAnalytics } from "../../hooks/useReconcile.js";

/**
 * v0.10.0 — Analytics dashboard for reconcile_pending.
 *
 * Three panels in one snapshot (single round-trip):
 *   1. Donut by `via` (fuzzy / llm / none)
 *   2. Histogram by confidence (5 fixed buckets)
 *   3. Top-10 reasoning groups (clickable to filter the pendings table)
 *
 * `onSelectReasoning(reasoning)` is provided by <ReconcileTab/> so the
 * admin can drill from a reasoning group into the matching rows.
 */
const VIA_COLORS = {
  fuzzy: "bg-emerald-400",
  llm: "bg-blue-400",
  none: "bg-amber-400",
};

const VIA_LABEL = {
  fuzzy: "Fuzzy",
  llm: "LLM",
  none: "Sin candidatos",
};

export default function AnalyticsTab({ onSelectReasoning }) {
  const { data, isLoading, isError, error } = useReconcileAnalytics();

  if (isLoading) {
    return (
      <div className="rounded-lg bg-surface-overlay px-3 py-6 text-center text-sm text-text-muted">
        Cargando analytics…
      </div>
    );
  }
  if (isError) {
    return (
      <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/30">
        Error: {error?.message ?? "fetch failed"}
      </div>
    );
  }

  const total = data.total_pending ?? 0;
  const byVia = data.by_via ?? {};
  const byConf = data.by_confidence ?? {};
  const top = data.top_reasonings ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface-overlay p-4 ring-1 ring-surface-border">
        <div className="text-sm text-text-muted">Total pendientes</div>
        <div className="text-3xl font-bold text-text-primary">{total}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl bg-surface-overlay p-4 ring-1 ring-surface-border space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">Por origen</h3>
          {total === 0 ? (
            <div className="text-xs text-text-muted">Sin datos.</div>
          ) : (
            <div className="space-y-2">
              <div className="flex h-3 overflow-hidden rounded-full bg-surface-base">
                {["fuzzy", "llm", "none"].map((v) => {
                  const n = byVia[v] ?? 0;
                  const pct = total > 0 ? (n / total) * 100 : 0;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={v}
                      className={VIA_COLORS[v]}
                      style={{ width: `${pct}%` }}
                      title={`${VIA_LABEL[v]}: ${n} (${pct.toFixed(1)}%)`}
                    />
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {["fuzzy", "llm", "none"].map((v) => {
                  const n = byVia[v] ?? 0;
                  const pct = total > 0 ? (n / total) * 100 : 0;
                  return (
                    <div key={v} className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded ${VIA_COLORS[v]}`} />
                      <span className="text-text-muted">{VIA_LABEL[v]}:</span>
                      <span className="text-text-primary font-medium">{n}</span>
                      <span className="text-text-muted">({pct.toFixed(0)}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-surface-overlay p-4 ring-1 ring-surface-border space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">Por confianza</h3>
          <div className="space-y-1.5">
            {Object.entries(byConf).map(([bucket, n]) => {
              const pct = total > 0 ? (n / total) * 100 : 0;
              return (
                <div key={bucket} className="space-y-0.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-muted font-mono">{bucket}</span>
                    <span className="text-text-primary">{n}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-base overflow-hidden">
                    <div className="h-full bg-tvt-yellow" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-surface-overlay p-4 ring-1 ring-surface-border space-y-2">
        <h3 className="text-sm font-semibold text-text-primary">Top reasonings</h3>
        {top.length === 0 ? (
          <div className="text-xs text-text-muted">Sin reasonings agrupables.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-surface-border text-xs">
              <thead>
                <tr className="text-left text-text-muted">
                  <th className="py-1.5 pr-2 font-medium">#</th>
                  <th className="py-1.5 pr-2 font-medium">Via</th>
                  <th className="py-1.5 pr-2 font-medium">Reasoning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {top.map((g) => {
                  const rowKey = `${g.via}:${g.reasoning}`;
                  const clickable = Boolean(onSelectReasoning);
                  const handleActivate = () => onSelectReasoning?.(g.reasoning);
                  return (
                    <tr
                      key={rowKey}
                      className={`hover:bg-surface-base ${clickable ? "cursor-pointer" : ""}`}
                      onClick={clickable ? handleActivate : undefined}
                      onKeyDown={
                        clickable
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleActivate();
                              }
                            }
                          : undefined
                      }
                      tabIndex={clickable ? 0 : undefined}
                    >
                      <td className="py-1.5 pr-2 align-top text-text-primary font-medium">{g.n}</td>
                      <td className="py-1.5 pr-2 align-top">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] ${
                            g.via === "fuzzy"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : g.via === "llm"
                                ? "bg-blue-500/15 text-blue-300"
                                : "bg-amber-500/15 text-amber-300"
                          }`}
                        >
                          {g.via}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 align-top text-text-muted">
                        <div className="line-clamp-2 max-w-2xl">{g.reasoning}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
