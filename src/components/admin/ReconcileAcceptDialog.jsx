import { useMemo, useState } from "react";
import { useReconcileAccept } from "../../hooks/useReconcile.js";
import { resolveImageUrl } from "../../lib/image.js";
import TmdbSearchSelector from "./TmdbSearchSelector.jsx";

/**
 * v0.10.0 — Accept a pending reconcile row.
 *
 * Two tabs:
 *   1. "Propuesta IA"  — accept the LLM proposal as-is (disabled when
 *                        target_tmdb_id is null — the 88 %-`via=none`
 *                        cases)
 *   2. "Buscar TMDB"   — admin types a likely title and picks one of
 *                        the top-10 TMDB hits to override the proposal.
 *                        Pre-fills the input with the series title.
 *
 * For `via='none'` pendings the dialog auto-opens on the "Buscar TMDB"
 * tab so the admin starts in the right place.
 *
 * Props:
 *   - pending: full row from GET /admin/reconcile/pending
 *   - onClose(): called after accept success or cancel
 */
export default function ReconcileAcceptDialog({ pending, onClose }) {
  const accept = useReconcileAccept();
  const proposal = pending?.ai_proposal ?? {};
  const proposalTmdbId = proposal?.target_tmdb_id ?? null;
  const aiTabAvailable = Boolean(proposalTmdbId);

  const [tab, setTab] = useState(aiTabAvailable ? "ai" : "search");
  const [selected, setSelected] = useState(null);

  const initialQuery = useMemo(() => {
    return (pending?.series_title ?? "").trim();
  }, [pending?.series_title]);

  function handleAcceptAi() {
    if (!proposalTmdbId) return;
    accept.mutate(
      {
        pendingId: pending.id,
        target_tmdb_id: proposalTmdbId,
        target_season_number: proposal?.target_season_number ?? null,
        kind: proposal?.kind ?? "same_series",
      },
      { onSuccess: () => onClose?.() }
    );
  }

  function handleAcceptManual() {
    if (!selected) return;
    accept.mutate(
      {
        pendingId: pending.id,
        target_tmdb_id: selected.tmdb_id,
        kind: "same_series",
      },
      { onSuccess: () => onClose?.() }
    );
  }

  const aiCandidate = useMemo(() => {
    if (!proposalTmdbId) return null;
    return (pending?.candidates ?? []).find((c) => c.tmdb_id === proposalTmdbId);
  }, [pending?.candidates, proposalTmdbId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-2xl rounded-2xl bg-surface-base p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Aceptar reconcile</h2>
            <div className="text-xs text-text-muted">
              #{pending.id} · {pending.series_title ?? `series ${pending.series_id}`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted hover:bg-surface-overlay"
            aria-label="Cerrar"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-5 w-5"
              role="img"
              aria-labelledby="reconcile-close-icon"
            >
              <title id="reconcile-close-icon">Cerrar</title>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-1 rounded-lg bg-surface-overlay p-1">
          <button
            type="button"
            onClick={() => setTab("ai")}
            disabled={!aiTabAvailable}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === "ai"
                ? "bg-tvt-yellow text-black"
                : aiTabAvailable
                  ? "text-text-primary hover:bg-surface-base"
                  : "text-text-muted opacity-50 cursor-not-allowed"
            }`}
          >
            Propuesta IA
            {!aiTabAvailable && " (sin candidato)"}
          </button>
          <button
            type="button"
            onClick={() => setTab("search")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === "search"
                ? "bg-tvt-yellow text-black"
                : "text-text-primary hover:bg-surface-base"
            }`}
          >
            Buscar TMDB
          </button>
        </div>

        {tab === "ai" && aiTabAvailable && (
          <div className="space-y-3">
            <div className="rounded-lg bg-surface-overlay p-3 ring-1 ring-surface-border">
              <div className="flex gap-3">
                {aiCandidate?.poster_path && (
                  <img
                    src={resolveImageUrl(aiCandidate.poster_path, "w154")}
                    alt={`Poster ${aiCandidate?.title ?? `tmdb:${proposalTmdbId}`}`}
                    className="h-24 w-16 flex-shrink-0 rounded object-cover bg-surface-base"
                  />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-sm font-semibold text-text-primary">
                    {aiCandidate?.title ?? `tmdb:${proposalTmdbId}`}
                  </div>
                  {aiCandidate?.original_name && (
                    <div className="text-xs text-text-muted">{aiCandidate.original_name}</div>
                  )}
                  <div className="text-[11px] text-text-muted">
                    kind: <span className="text-text-primary">{proposal?.kind}</span>
                    {" · "}
                    confidence:{" "}
                    <span className="text-text-primary">
                      {(proposal?.confidence ?? 0).toFixed(2)}
                    </span>
                    {" · "}
                    via: <span className="text-text-primary">{proposal?.via ?? "n/a"}</span>
                  </div>
                </div>
              </div>
              {proposal?.reasoning && (
                <div className="mt-3 rounded bg-surface-base p-2 text-xs text-text-primary leading-relaxed">
                  {proposal.reasoning}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-surface-overlay px-3 py-1.5 text-xs text-text-primary hover:bg-surface-base"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAcceptAi}
                disabled={accept.isPending}
                className="rounded-lg bg-tvt-yellow px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
              >
                {accept.isPending ? "Aplicando…" : "Aceptar propuesta IA"}
              </button>
            </div>
          </div>
        )}

        {tab === "search" && (
          <div className="space-y-3">
            <TmdbSearchSelector
              initialQuery={initialQuery}
              selectedTmdbId={selected?.tmdb_id ?? null}
              onSelect={setSelected}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-surface-overlay px-3 py-1.5 text-xs text-text-primary hover:bg-surface-base"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAcceptManual}
                disabled={!selected || accept.isPending}
                className="rounded-lg bg-tvt-yellow px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
              >
                {accept.isPending
                  ? "Aplicando…"
                  : selected
                    ? `Usar tmdb:${selected.tmdb_id}`
                    : "Selecciona un resultado"}
              </button>
            </div>
          </div>
        )}

        {accept.isError && (
          <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/30">
            {accept.error?.message ?? "Apply failed"}
          </div>
        )}
      </div>
    </div>
  );
}
