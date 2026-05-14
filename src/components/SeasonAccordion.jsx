import { useMemo, useState } from "react";
import { useSeasonEpisodes } from "../hooks/useSeasonEpisodes.js";
import EpisodeRow from "./EpisodeRow.jsx";
import LanguageBadges from "./ui/LanguageBadges.jsx";
import ProgressBar from "./ui/ProgressBar.jsx";

/**
 * Diálogo bidireccional para acciones bulk en episodios.
 * - mode="mark":   "¿Marcar episodios anteriores también como vistos?"
 * - mode="unmark": "¿Desmarcar episodios posteriores también?"
 */
function BulkActionDialog({ count, mode, onConfirm, onDecline }) {
  const isMark = mode === "mark";
  const title = isMark ? "¿Marcar episodios anteriores?" : "¿Desmarcar episodios posteriores?";
  const message = isMark
    ? `Hay ${count} ${count === 1 ? "episodio anterior sin ver" : "episodios anteriores sin ver"}. ¿Quieres marcarlos también como vistos?`
    : `Hay ${count} ${count === 1 ? "episodio posterior visto" : "episodios posteriores vistos"}. ¿Quieres desmarcarlos también?`;
  const declineLabel = isMark ? "Solo este" : "Solo este";
  const confirmLabel = isMark ? "Marcar todos" : "Desmarcar todos";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onDecline}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-2xl bg-surface-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-base font-semibold">{title}</h3>
        <p className="mb-5 text-sm text-text-secondary">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onDecline}
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-overlay transition-colors"
          >
            {declineLabel}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-tvt-yellow px-4 py-2 text-sm font-medium text-surface-base hover:bg-tvt-yellow/90 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SeasonAccordion({
  season,
  seriesId,
  watchedIds = new Set(),
  onToggle,
  onMarkBulk,
  onUnmarkBulk,
  scraping = false,
  // Slots opcionales para inyectar UI per-episodio desde el consumer
  // (p.ej. botón admin "Cambiar TMDB" + MatchDialog colapsable en
  // TelegramTVShow). Devuelven ReactNode o null.
  renderEpisodeActions = null,
  renderEpisodeBelow = null,
}) {
  const [open, setOpen] = useState(false);
  // pending: { episodeId, ids: number[], mode: "mark" | "unmark" }
  const [pending, setPending] = useState(null);

  const { data: episodes = [] } = useSeasonEpisodes(season.id);

  const watchedCount = useMemo(
    () => episodes.filter((ep) => watchedIds.has(ep.id)).length,
    [episodes, watchedIds]
  );
  const total = episodes.length || season.episode_count;
  const progress = total > 0 ? Math.round((watchedCount / total) * 100) : 0;
  const allWatched = total > 0 && watchedCount === total;

  function handleEpisodeToggle(episodeId, shouldMark) {
    const sorted = [...episodes].sort((a, b) => a.episode_number - b.episode_number);
    const idx = sorted.findIndex((ep) => ep.id === episodeId);

    if (shouldMark) {
      // Marcar este → preguntar si marcar también los anteriores no vistos
      const prevUnwatched = sorted.slice(0, idx).filter((ep) => !watchedIds.has(ep.id));
      if (prevUnwatched.length > 0) {
        setPending({
          episodeId,
          ids: prevUnwatched.map((ep) => ep.id),
          mode: "mark",
        });
      } else {
        onToggle?.(episodeId, true);
      }
    } else {
      // Desmarcar este → preguntar si desmarcar también los posteriores vistos
      const nextWatched = sorted.slice(idx + 1).filter((ep) => watchedIds.has(ep.id));
      if (nextWatched.length > 0) {
        setPending({
          episodeId,
          ids: nextWatched.map((ep) => ep.id),
          mode: "unmark",
        });
      } else {
        onToggle?.(episodeId, false);
      }
    }
  }

  function handleConfirmPending() {
    if (!pending) return;
    if (pending.mode === "mark") {
      onMarkBulk?.([...pending.ids, pending.episodeId]);
    } else {
      onUnmarkBulk?.([...pending.ids, pending.episodeId]);
    }
    setPending(null);
  }

  function handleDeclinePending() {
    if (!pending) return;
    onToggle?.(pending.episodeId, pending.mode === "mark");
    setPending(null);
  }

  function handleMarkSeason(e) {
    e.stopPropagation();
    const unwatchedIds = episodes.filter((ep) => !watchedIds.has(ep.id)).map((ep) => ep.id);
    if (unwatchedIds.length > 0) onMarkBulk?.(unwatchedIds);
  }

  function handleUnmarkSeason(e) {
    e.stopPropagation();
    const watchedEpIds = episodes.filter((ep) => watchedIds.has(ep.id)).map((ep) => ep.id);
    if (watchedEpIds.length > 0) onUnmarkBulk?.(watchedEpIds);
  }

  return (
    <>
      <div className="rounded-xl bg-surface-card overflow-hidden">
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-card-hover"
        >
          {/* Mark-season circle — always visible when not all watched */}
          {!allWatched && episodes.length > 0 && (
            <button
              onClick={handleMarkSeason}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 border-border-default hover:border-tvt-yellow transition-all duration-150"
              title="Marcar toda la temporada como vista"
            />
          )}
          {allWatched && (
            <button
              onClick={handleUnmarkSeason}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 border-tvt-yellow bg-tvt-yellow hover:bg-tvt-yellow/80 transition-colors"
              title="Desmarcar toda la temporada"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                className="h-3.5 w-3.5 text-surface-base"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">
                {season.name || `Temporada ${season.season_number}`}
              </span>
              {season.languages && season.languages.length > 0 && (
                <LanguageBadges languages={season.languages} />
              )}
              {season.stream_coverage_pct != null && season.stream_coverage_pct < 100 && total > 0 && (
                <span
                  className="text-[10px] text-text-muted"
                  title={`${season.stream_coverage_pct}% de capítulos tienen enlaces de stream`}
                >
                  · {season.stream_coverage_pct}% scrapeado
                </span>
              )}
            </div>
            {total > 0 && (
              <div className="mt-1.5 flex items-center gap-2">
                <ProgressBar value={progress} className="flex-1" />
                <span className="text-xs text-text-muted whitespace-nowrap">
                  {watchedCount}/{total}
                </span>
              </div>
            )}
          </div>

          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className={[
              "h-5 w-5 flex-shrink-0 text-text-muted transition-transform duration-200",
              open ? "rotate-180" : "",
            ].join(" ")}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="border-t border-border-subtle px-4 pb-3 pt-1">
            {episodes.length === 0 ? (
              <p className="py-3 text-sm text-text-muted">Sin episodios registrados.</p>
            ) : (
              episodes.map((ep) => (
                <EpisodeRow
                  key={ep.id}
                  episode={ep}
                  seriesId={seriesId}
                  watched={watchedIds.has(ep.id)}
                  onToggle={handleEpisodeToggle}
                  scraping={scraping}
                  extraActions={renderEpisodeActions ? renderEpisodeActions(ep) : null}
                  extraBelow={renderEpisodeBelow ? renderEpisodeBelow(ep) : null}
                />
              ))
            )}
          </div>
        )}
      </div>

      {pending && (
        <BulkActionDialog
          count={pending.ids.length}
          mode={pending.mode}
          onConfirm={handleConfirmPending}
          onDecline={handleDeclinePending}
        />
      )}
    </>
  );
}
