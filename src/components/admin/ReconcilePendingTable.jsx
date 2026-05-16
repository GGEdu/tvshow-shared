import { useMemo, useState } from "react";
import { useReconcileDiscard, useReconcilePending } from "../../hooks/useReconcile.js";
import ReconcileAcceptDialog from "./ReconcileAcceptDialog.jsx";

/**
 * v0.10.0 — Pending-reconciles table.
 *
 * Renders rows from GET /admin/reconcile/pending with three actions:
 *   - Accept (opens <ReconcileAcceptDialog/>)
 *   - Discard (one-click, with confirm)
 *   - Open URL (external link to the source site)
 *
 * Props:
 *   - filterReasoning: optional substring filter on ai_proposal.reasoning,
 *     set externally by <AnalyticsTab/> when admin clicks a reasoning group.
 *   - limit: max rows fetched (50-200).
 */
export default function ReconcilePendingTable({
  filterReasoning = null,
  onClearFilter,
  limit = 100,
}) {
  const { data: pendings = [], isLoading, isError, error } = useReconcilePending({ limit });
  const discard = useReconcileDiscard();
  const [acceptingId, setAcceptingId] = useState(null);

  const filtered = useMemo(() => {
    if (!filterReasoning) return pendings;
    const needle = filterReasoning.toLowerCase();
    return pendings.filter((p) => (p?.ai_proposal?.reasoning ?? "").toLowerCase().includes(needle));
  }, [pendings, filterReasoning]);

  const accepting = filtered.find((p) => p.id === acceptingId) ?? null;

  if (isLoading) {
    return (
      <div className="rounded-lg bg-surface-overlay px-3 py-6 text-center text-sm text-text-muted">
        Cargando pendings…
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

  return (
    <div className="space-y-3">
      {filterReasoning && (
        <div className="flex items-center justify-between rounded-lg bg-tvt-yellow/10 px-3 py-2 ring-1 ring-tvt-yellow/30 text-xs">
          <span className="text-text-primary">
            Filtro: <span className="font-mono">{filterReasoning}</span>
          </span>
          <button type="button" onClick={onClearFilter} className="text-tvt-yellow hover:underline">
            quitar
          </button>
        </div>
      )}

      <div className="text-xs text-text-muted">
        {filtered.length} {filtered.length === 1 ? "pendiente" : "pendientes"}
        {filtered.length !== pendings.length && ` (de ${pendings.length} totales)`}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg bg-surface-overlay px-3 py-6 text-center text-sm text-text-muted">
          Sin pendientes.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg ring-1 ring-surface-border">
          <table className="min-w-full divide-y divide-surface-border text-xs">
            <thead className="bg-surface-overlay">
              <tr className="text-left text-text-muted">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Serie</th>
                <th className="px-3 py-2 font-medium">Kind</th>
                <th className="px-3 py-2 font-medium">Via</th>
                <th className="px-3 py-2 font-medium">Conf.</th>
                <th className="px-3 py-2 font-medium">Reasoning</th>
                <th className="px-3 py-2 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border bg-surface-base">
              {filtered.map((p) => {
                const prop = p.ai_proposal ?? {};
                return (
                  <tr key={p.id} className="hover:bg-surface-overlay/50">
                    <td className="px-3 py-2 align-top text-text-muted">{p.id}</td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-text-primary truncate max-w-[18rem]">
                        {p.series_title ?? `series ${p.series_id}`}
                      </div>
                      <div className="text-[10px] text-text-muted">sid:{p.series_id}</div>
                    </td>
                    <td className="px-3 py-2 align-top text-text-primary">
                      {prop.kind ?? p.kind ?? "—"}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] ${
                          prop.via === "fuzzy"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : prop.via === "llm"
                              ? "bg-blue-500/15 text-blue-300"
                              : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {prop.via ?? "none"}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top text-text-primary">
                      {(prop.confidence ?? 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 align-top text-text-muted">
                      <div className="line-clamp-2 max-w-md">{prop.reasoning ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2 align-top text-right whitespace-nowrap">
                      {p.series_url && (
                        <a
                          href={p.series_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mr-2 text-xs text-text-muted hover:text-tvt-yellow"
                          title="Abrir origen"
                        >
                          ↗
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setAcceptingId(p.id)}
                        className="rounded bg-tvt-yellow px-2 py-1 text-[11px] font-semibold text-black hover:opacity-90"
                      >
                        Aceptar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(`Descartar pending #${p.id}? La serie no se modificará.`)
                          ) {
                            discard.mutate({ pendingId: p.id });
                          }
                        }}
                        disabled={discard.isPending}
                        className="ml-1 rounded bg-surface-overlay px-2 py-1 text-[11px] text-text-primary hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50"
                      >
                        Descartar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {accepting && (
        <ReconcileAcceptDialog pending={accepting} onClose={() => setAcceptingId(null)} />
      )}
    </div>
  );
}
