import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServices } from "../../contexts/ServicesContext.jsx";
import { resolveImageUrl } from "../../lib/image.js";
import { useReassignStream } from "../../hooks/useStreamActions.js";

/**
 * v0.9.0 — Generalizes TelegramTVShow's MatchDialog to work with stream
 * primitives instead of telegram_message_id. Calls
 *   PATCH /streams/{streamId}
 * with `{ tmdb_id, season_number, episode_number, language, quality }`.
 *
 * Works on both AgenticTVShow (scraped sources) and TelegramTVShow
 * (telegram_native + external_url) because the backend abstraction lives
 * in StreamService.reassign().
 *
 * Consumer's `seriesService.searchTmdb(query, { limit })` is still used
 * for the candidate list — it's already shared by sync/retarget flows.
 */
export default function ReassignStreamDialog({
  streamId,
  seriesId,
  initialLanguage = "UNK",
  initialQuality = "",
  invalidate = [],
  onSuccess,
  onCancel,
}) {
  const { seriesService } = useServices();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [season, setSeason] = useState("");
  const [episode, setEpisode] = useState("");
  const [language, setLanguage] = useState(initialLanguage || "UNK");
  const [quality, setQuality] = useState(initialQuality || "");

  const reassign = useReassignStream({ seriesId });

  const { data: candidates = [], isFetching } = useQuery({
    queryKey: ["tmdb-search-series", query],
    queryFn: () => seriesService.searchTmdb(query, { limit: 8 }),
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  function handleSubmit() {
    if (!selected || !season || !episode) return;
    reassign.mutate(
      {
        streamId,
        body: {
          tmdb_id: selected.tmdb_id,
          season_number: Number(season),
          episode_number: Number(episode),
          language: language || "UNK",
          quality: quality || null,
        },
        invalidate,
      },
      { onSuccess: () => onSuccess?.() },
    );
  }

  const canSubmit = selected && season && episode && !reassign.isPending;

  return (
    <div className="mt-3 rounded-xl border border-border-subtle bg-surface-overlay p-4 space-y-3">
      {/* Search */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-text-muted">Buscar serie en TMDB</p>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
          placeholder="Título de la serie…"
          className="w-full rounded-lg bg-surface-card px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none ring-1 ring-border-subtle focus:ring-tvt-yellow"
        />
      </div>

      {query.trim().length >= 2 && (
        <div className="max-h-40 overflow-y-auto space-y-1">
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
                  "w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                  selected?.tmdb_id === c.tmdb_id
                    ? "bg-tvt-yellow/20 text-text-primary ring-1 ring-tvt-yellow/50"
                    : "hover:bg-surface-card text-text-secondary",
                ].join(" ")}
              >
                {c.poster_path && (
                  <img
                    src={resolveImageUrl(c.poster_path, "w92")}
                    alt=""
                    className="h-8 w-5 flex-shrink-0 rounded object-cover"
                    referrerPolicy="no-referrer"
                  />
                )}
                <span className="flex-1 truncate">
                  {c.name}
                  {c.first_air_date && (
                    <span className="ml-1 text-text-muted">({c.first_air_date.slice(0, 4)})</span>
                  )}
                </span>
                <span className="flex-shrink-0 text-text-muted">#{c.tmdb_id}</span>
              </button>
            ))
          )}
        </div>
      )}

      {selected && (
        <>
          <p className="text-xs text-tvt-yellow font-medium truncate">
            Serie: {selected.name} (TMDB #{selected.tmdb_id})
          </p>
          <div className="flex flex-wrap gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted">Temporada *</label>
              <input
                type="number" min="1" value={season} onChange={(e) => setSeason(e.target.value)}
                className="w-24 rounded-lg bg-surface-card px-2 py-1.5 text-sm ring-1 ring-border-subtle focus:ring-tvt-yellow focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted">Episodio *</label>
              <input
                type="number" min="1" value={episode} onChange={(e) => setEpisode(e.target.value)}
                className="w-24 rounded-lg bg-surface-card px-2 py-1.5 text-sm ring-1 ring-border-subtle focus:ring-tvt-yellow focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted">Idioma</label>
              <select
                value={language} onChange={(e) => setLanguage(e.target.value)}
                className="rounded-lg bg-surface-card px-2 py-1.5 text-sm ring-1 ring-border-subtle focus:ring-tvt-yellow focus:outline-none"
              >
                {["UNK", "ES", "EN", "LAT", "DUAL", "SUB"].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted">Calidad</label>
              <input
                type="text" value={quality} onChange={(e) => setQuality(e.target.value)}
                placeholder="HD, 4K…"
                className="w-24 rounded-lg bg-surface-card px-2 py-1.5 text-sm ring-1 ring-border-subtle focus:ring-tvt-yellow focus:outline-none"
              />
            </div>
          </div>
        </>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded-lg bg-tvt-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-tvt-blue/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {reassign.isPending ? "Guardando…" : "Reasignar enlace"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg bg-surface-card px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-card-hover transition-colors"
        >
          Cancelar
        </button>
        {reassign.isError && (
          <span className="text-xs text-tvt-red">
            {reassign.error?.message ?? "Error al reasignar"}
          </span>
        )}
      </div>
    </div>
  );
}
