import { useState } from "react";
import { resolveImageUrl } from "../lib/image.js";

export default function SeriesHero({ series, children, onEditPoster }) {
  const [backdropError, setBackdropError] = useState(false);
  const [posterError, setPosterError] = useState(false);

  const backdrop = series.backdrop_path
    ? resolveImageUrl(series.backdrop_path, "w1280")
    : null;
  const poster = series.poster_path
    ? resolveImageUrl(series.poster_path, "w300")
    : null;

  const showBackdrop = backdrop && !backdropError;
  const showPoster = poster && !posterError;

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl">
      {/* Background: backdrop or blurred poster */}
      {showBackdrop ? (
        <img
          src={backdrop}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setBackdropError(true)}
        />
      ) : showPoster ? (
        <img
          src={poster}
          alt=""
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl opacity-30"
          referrerPolicy="no-referrer"
          onError={() => setPosterError(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-surface-overlay" />
      )}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-surface-base via-surface-base/70 to-surface-base/20" />

      {/* Content */}
      <div className="relative flex flex-col gap-5 p-5 pt-8 sm:flex-row sm:items-end sm:p-8">
        {/* Poster with optional edit button */}
        <div className="group relative flex-shrink-0 self-center sm:self-auto">
          {showPoster ? (
            <img
              src={poster}
              alt={series.title}
              className="h-44 w-32 rounded-xl object-cover shadow-2xl"
              referrerPolicy="no-referrer"
              onError={() => setPosterError(true)}
            />
          ) : (
            <div className="flex h-44 w-32 items-center justify-center rounded-xl bg-surface-overlay text-xs text-text-muted shadow-2xl">
              Sin imagen
            </div>
          )}
          {onEditPoster && (
            <button
              onClick={() => onEditPoster(series.poster_path)}
              title="Cambiar portada"
              className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.828l-3 1 1-3a4 4 0 01.828-1.414z" />
              </svg>
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
