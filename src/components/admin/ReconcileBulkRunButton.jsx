import { useState } from "react";
import { useReconcileBulkRun } from "../../hooks/useReconcile.js";

/**
 * v0.10.0 — Trigger POST /admin/reconcile/run-full.
 *
 * Two knobs:
 *   - limit (integer, optional): cap series processed in this run
 *   - dry_run (toggle): classify with the LLM but DON'T apply or enqueue
 *
 * Renders the summary returned by the endpoint inline so the admin
 * can immediately see what changed.
 */
export default function ReconcileBulkRunButton() {
  const [limit, setLimit] = useState("50");
  const [dryRun, setDryRun] = useState(true);
  const bulk = useReconcileBulkRun();

  function handleRun() {
    const parsed = limit.trim() === "" ? null : Number.parseInt(limit, 10);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 1)) {
      return;
    }
    bulk.mutate({ limit: parsed, dry_run: dryRun });
  }

  const report = bulk.data ?? null;

  return (
    <div className="rounded-xl bg-surface-overlay p-4 ring-1 ring-surface-border space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text-primary">Bulk Reconciler</h3>
        <div className="text-[11px] text-text-muted">POST /admin/reconcile/run-full</div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-[11px] text-text-muted">Limit</span>
          <input
            type="number"
            min={1}
            max={2000}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="all"
            className="w-24 rounded bg-surface-base px-2 py-1 text-xs text-text-primary ring-1 ring-surface-border focus:ring-tvt-yellow focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-text-primary">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="h-4 w-4 accent-tvt-yellow"
          />
          dry_run (no aplica cambios)
        </label>
        <button
          type="button"
          onClick={handleRun}
          disabled={bulk.isPending}
          className="ml-auto rounded-lg bg-tvt-yellow px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
        >
          {bulk.isPending ? "Ejecutando…" : "Ejecutar"}
        </button>
      </div>

      {bulk.isError && (
        <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/30">
          {bulk.error?.message ?? "run failed"}
        </div>
      )}

      {report && (
        <div className="rounded-lg bg-surface-base p-3 text-xs space-y-1 ring-1 ring-surface-border">
          <div className="text-text-primary font-medium">
            Resumen{" "}
            {report.duration_seconds != null && (
              <span className="text-text-muted">({report.duration_seconds.toFixed(1)}s)</span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-text-muted">
            <div>
              candidates: <span className="text-text-primary">{report.candidates}</span>
            </div>
            <div>
              applied: <span className="text-emerald-300">{report.applied_auto}</span>
            </div>
            <div>
              queued: <span className="text-amber-300">{report.queued_for_review}</span>
            </div>
            <div>
              errored:{" "}
              <span className={report.errored > 0 ? "text-red-300" : "text-text-primary"}>
                {report.errored}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
