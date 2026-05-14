import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServices } from "../../contexts/ServicesContext.jsx";
import { resolveImageUrl } from "../../lib/image.js";
import { useRetargetTmdb } from "../../hooks/useRetargetTmdb.js";

/**
 * v0.9.0 — Non-destructive TMDB retarget dialog.
 *
 * Replaces the per-app duplicated RetargetTmdbDialog. The backend now
 * preserves streams (snapshot → detach → remap), so this dialog drops
 * the destructive checkbox and the Telegram-specific "reset_messages"
 * option. Streams that don't remap automatically land in the
 * <OrphanStreamsBanner /> for manual handling.
 *
 * Consumer's seriesService must expose:
 *   - searchTmdb(query, { limit })
 *   - retargetTmdb(seriesId, newTmdbId)
 */
export default function RetargetTmdbDialog({ seriesId, onClose }) {
  const { seriesService } = useServices();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const retarget = useRetargetTmdb(seriesId);

  const { data: candidates = [], isFetching } = useQuery({
    queryKey: ["tmdb-search", query],
    queryFn: () => seriesService.searchTmdb(query, { limit: 8 }),
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  function handleConfirm() {
    if (!selected) return;
    retarget.mutate(selected.tmdb_id, { onSuccess: () => onClose?.() });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-lg rounded-2xl bg-surface-base p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">Cambiar target TMDB</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted hover:bg-surface-overlay transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="rounded-xl bg-tvt-yellow/10 p-3 ring-1 ring-tvt-yellow/30 text-xs text-text-primary leading-relaxed">
          Esto regenera la serie con el nuevo TMDB target. Los enlaces existentes
          se intentarán migrar a los nuevos episodios; los que no encuentren
          equivalente quedarán pendientes en el banner de "huérfanos" para
          reasignarlos manualmente.
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-text-muted">Buscar serie correcta en TMDB</p>
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
            placeholder="Título de la serie…"
            className="w-full rounded-lg bg-surface-card px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none ring-1 ring-border-subtle focus:ring-tvt-yellow"
          />
        </div>

        {query.trim().length >= 2 && (
          <div className="max-h-48 overflow-y-auto space-y-1">
            {isFetching ? (
              <p className="text-xs text-text-muted py-2 text-center">Buscando…</p>
            ) : candidates.length === 0 ? (
              <p className="text-xs text-text-muted py-2 text-center">Sin resultados</p>
            ) : (
              candidates.map((c) => (
                <button
                  key={c.tmdb_id}
                  type="button"
                  onClick={() => setSelected(c)}
                  className={[
                    "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    selected?.tmdb_id === c.tmdb_id
                      ? "bg-tvt-yellow/20 text-text-primary ring-1 ring-tvt-yellow/50"
                      : "hover:bg-surface-card text-text-secondary",
                  ].join(" ")}
                >
                  {c.poster_path && (
                    <img
                      src={resolveImageUrl(c.poster_path, "w92")}
                      alt=""
                      className="h-12 w-8 flex-shrink-0 rounded object-cover"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    <p className="text-xs text-text-muted">
                      {c.first_air_date?.slice(0, 4)}
                      {c.original_language && ` · ${c.original_language.toUpperCase()}`}
                      {` · TMDB #${c.tmdb_id}`}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {selected && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={retarget.isPending}
              className="w-full rounded-xl bg-tvt-yellow px-4 py-2.5 text-sm font-semibold text-surface-base hover:bg-tvt-yellow/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {retarget.isPending
                ? "Aplicando retarget…"
                : `Retarget a "${selected.name}" (TMDB #${selected.tmdb_id})`}
            </button>

            {retarget.isSuccess && (
              <p className="text-xs text-tvt-green">
                Retarget aplicado. La re-sincronización TMDB y el remap de enlaces
                se ejecutan en background.
              </p>
            )}
            {retarget.isError && (
              <p className="text-xs text-tvt-red">
                {retarget.error?.message ?? "Error al retargetear"}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
