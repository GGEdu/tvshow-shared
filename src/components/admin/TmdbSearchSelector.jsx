import { useEffect, useMemo, useRef, useState } from "react";
import { useAdminTmdbSearch } from "../../hooks/useReconcile.js";
import { resolveImageUrl } from "../../lib/image.js";

/**
 * v0.10.0 — TMDB free-text search + card-grid picker for admin flows.
 *
 * Used inside <ReconcileAcceptDialog/> as the primary action for the
 * 88 %-`via=none` cases ("TMDB returned no candidates" — admin types
 * a likely title, picks a TMDB row, accepts it).
 *
 * Props:
 *   - initialQuery: string — pre-fills the input (typically series title)
 *   - onSelect(tmdbResult): called when the admin clicks a card. The
 *     parent decides what to do with it (e.g. forward to /accept).
 *   - selectedTmdbId: optional — highlights the chosen row
 *   - placeholder: optional input placeholder
 */
export default function TmdbSearchSelector({
  initialQuery = "",
  onSelect,
  selectedTmdbId = null,
  placeholder = "Buscar en TMDB…",
}) {
  const [raw, setRaw] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery);
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(raw), 300);
    return () => clearTimeout(t);
  }, [raw]);

  // Manual focus on mount (replaces the autoFocus attribute which Biome
  // flags as an a11y antipattern; programmatic focus inside a dialog is
  // the recommended workaround).
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const { data, isFetching, isError, error } = useAdminTmdbSearch(debounced);
  const results = useMemo(() => data?.results ?? [], [data]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg bg-surface-overlay px-3 py-2 text-sm text-text-primary placeholder:text-text-muted ring-1 ring-surface-border focus:ring-tvt-yellow focus:outline-none"
        />
        {isFetching && (
          <div className="absolute right-3 top-2.5 text-xs text-text-muted">buscando…</div>
        )}
      </div>

      {isError && (
        <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/30">
          Error: {error?.message ?? "TMDB search failed"}
        </div>
      )}

      {!isFetching && debounced.length >= 2 && results.length === 0 && (
        <div className="rounded-lg bg-surface-overlay px-3 py-4 text-center text-xs text-text-muted">
          Sin resultados para «{debounced}»
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
        {results.map((r) => {
          const active = selectedTmdbId === r.tmdb_id;
          return (
            <button
              key={r.tmdb_id}
              type="button"
              onClick={() => onSelect?.(r)}
              className={`flex gap-2 rounded-lg p-2 text-left ring-1 transition-colors ${
                active
                  ? "bg-tvt-yellow/15 ring-tvt-yellow"
                  : "bg-surface-overlay ring-surface-border hover:bg-surface-base hover:ring-tvt-yellow/40"
              }`}
            >
              {r.poster_path ? (
                <img
                  src={resolveImageUrl(r.poster_path, "w92")}
                  alt={r.title ?? ""}
                  loading="lazy"
                  className="h-16 w-12 flex-shrink-0 rounded object-cover bg-surface-base"
                />
              ) : (
                <div className="h-16 w-12 flex-shrink-0 rounded bg-surface-base" />
              )}
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="truncate text-sm font-medium text-text-primary">
                  {r.title ?? r.original_name ?? `tmdb:${r.tmdb_id}`}
                </div>
                {r.original_name && r.original_name !== r.title && (
                  <div className="truncate text-xs text-text-muted">{r.original_name}</div>
                )}
                <div className="flex items-center gap-2 text-[10px] text-text-muted">
                  {/* v0.11.0 — TV vs Movie badge. Helps admin pick the
                       right TMDB endpoint family (DBZ films live in
                       /movie, not /tv). */}
                  {r.media_type === "movie" && (
                    <span className="rounded bg-pink-500/20 px-1.5 py-0.5 font-medium text-pink-300">
                      MOVIE
                    </span>
                  )}
                  {r.media_type === "tv" && (
                    <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-medium text-sky-300">
                      TV
                    </span>
                  )}
                  <span>tmdb:{r.tmdb_id}</span>
                  {r.first_air_date && <span>· {r.first_air_date.slice(0, 4)}</span>}
                  {typeof r.popularity === "number" && (
                    <span>· pop {Math.round(r.popularity)}</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
