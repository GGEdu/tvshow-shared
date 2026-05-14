import { useNavigate } from "react-router-dom";
import { resolveImageUrl } from "../lib/image.js";
import { getLangMeta as _getLangMeta, LANG_META as _LANG_META } from "../lib/languages.js";
import FlagImg from "./ui/FlagImg.jsx";

// Re-exports preserved so existing imports (`{ LANG_META, FlagImg }` from
// EpisodeRow) keep working. The mapping itself now lives in lib/languages.js
// — single source of truth shared with LanguageBadges + PosterOverlay.
export const LANG_META = _LANG_META;
export const getLangMeta = _getLangMeta;
export { FlagImg };

// ── Clickable language badges ──────────────────────────────────────────────

function LanguageBadges({ languages, onLangClick }) {
  if (!languages?.length) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {languages.map((lang) => {
        const meta = getLangMeta(lang);
        const inner = (
          <>
            <div className="h-full w-full overflow-hidden rounded-full flex items-center justify-center">
              <FlagImg cc={meta.cc} label={meta.label} />
            </div>
            <span className="text-[10px] font-medium leading-none">{meta.short}</span>
          </>
        );

        return onLangClick ? (
          <button
            key={lang}
            title={lang}
            onClick={(e) => {
              e.stopPropagation();
              onLangClick(lang);
            }}
            className="flex items-center gap-1.5 h-9 pl-0.5 pr-2.5 flex-shrink-0 rounded-full bg-surface-overlay ring-1 ring-border-subtle transition-all hover:ring-tvt-yellow hover:bg-surface-overlay/80 active:scale-95"
          >
            <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-border-subtle">
              <FlagImg cc={meta.cc} label={meta.label} />
            </div>
            <span className="text-xs font-medium text-text-secondary">{meta.short}</span>
          </button>
        ) : (
          <span
            key={lang}
            title={lang}
            className="flex items-center gap-1.5 h-9 pl-0.5 pr-2.5 flex-shrink-0 rounded-full bg-surface-overlay ring-1 ring-border-subtle select-none"
          >
            <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-border-subtle">
              <FlagImg cc={meta.cc} label={meta.label} />
            </div>
            <span className="text-xs font-medium text-text-secondary">{meta.short}</span>
          </span>
        );
      })}
    </div>
  );
}

// ── Episode row ────────────────────────────────────────────────────────────

export default function EpisodeRow({
  episode,
  watched = false,
  onToggle,
  languages,
  seriesId,
  scraping = false,
  // Admin / per-episode action slots — consumers populate them when relevant
  // (p.ej. TelegramTVShow inyecta aquí su botón "Cambiar TMDB" + MatchDialog
  // colapsable). El paquete shared no asume nada sobre el contenido.
  extraActions = null,
  extraBelow = null,
}) {
  const navigate = useNavigate();

  const epLanguages = episode.languages?.length ? episode.languages : (languages ?? []);
  // While a fill-gap run is active, episodes that don't have any stream
  // yet show a spinner — they're the ones the scraper is currently
  // working on.
  const showSpinner = scraping && epLanguages.length === 0;

  function goToWatch(lang) {
    if (!seriesId) return;
    const params = lang ? `?lang=${encodeURIComponent(lang)}` : "";
    navigate(`/watch/${seriesId}/${episode.id}${params}`);
  }

  return (
    <div className="border-b border-border-subtle last:border-0">
      <div className="flex items-start gap-3 py-3 relative">
        {episode.still_path && (
          <div className="h-14 w-24 flex-shrink-0 overflow-hidden rounded-lg">
            <img
              src={resolveImageUrl(episode.still_path, "w185")}
              alt={episode.name}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div className="min-w-0 flex-1">
            {/* Title */}
            <p className="font-medium text-sm leading-snug">
              <span className="text-text-muted">{episode.episode_number}. </span>
              {episode.name || `Episodio ${episode.episode_number}`}
            </p>

            {/* Air date */}
            {episode.air_date && (
              <p className="text-xs text-text-muted mt-0.5">{episode.air_date}</p>
            )}

            {episode.overview && (
              <p className="mt-1 text-xs text-text-secondary line-clamp-2">{episode.overview}</p>
            )}

            {/* Lang badges — own row, separated for easy tap */}
            {epLanguages.length > 0 && (
              <div className="mt-2">
                <LanguageBadges
                  languages={epLanguages}
                  onLangClick={seriesId ? goToWatch : null}
                />
              </div>
            )}
          </div>

          {/* Slot opcional para acciones extra (admin-only, etc.).
              Se renderiza ANTES del toggle para no romper el alineado a la
              derecha del botón principal. */}
          {extraActions}

          {/* Watched toggle / scraping spinner */}
          {showSpinner ? (
            <span
              title="Scraping en curso para esta serie"
              className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                className="h-5 w-5 animate-spin text-tvt-yellow"
              >
                <path
                  strokeLinecap="round"
                  d="M21 12a9 9 0 11-6.219-8.56"
                />
              </svg>
            </span>
          ) : (
            <button
              onClick={() => onToggle?.(episode.id, !watched)}
              className={[
                "mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150",
                watched
                  ? "border-tvt-yellow bg-tvt-yellow text-surface-base"
                  : "border-border-default hover:border-tvt-yellow",
              ].join(" ")}
              aria-label={watched ? "Marcar no visto" : "Marcar como visto"}
            >
              {watched && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3.5 w-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
      {/* Panel expandible debajo de la fila (admin tools, MatchDialog, etc.) */}
      {extraBelow}
    </div>
  );
}
