import { useState } from "react";
import { useOrphanStreams, useDeleteStream } from "../../hooks/useStreamActions.js";
import ReassignStreamDialog from "./ReassignStreamDialog.jsx";

/**
 * v0.9.0 — Banner that surfaces streams of a series with `episode_id=NULL`
 * (typically left behind by a TMDB retarget that couldn't remap them to
 * the new tree). Click to expand the list; each row offers "Reasignar"
 * (opens <ReassignStreamDialog />) and "Borrar".
 *
 * Renders nothing if there are no orphans, so it's safe to drop in any
 * SeriesDetail page unconditionally.
 */
export default function OrphanStreamsBanner({ seriesId }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // streamId | null
  const { data: orphans = [], isLoading } = useOrphanStreams(seriesId);
  const deleteStream = useDeleteStream({ seriesId });

  if (isLoading || orphans.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-tvt-yellow/40 bg-tvt-yellow/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-tvt-yellow/10 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5 flex-shrink-0 text-tvt-yellow">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span className="text-sm font-medium text-text-primary">
            {orphans.length} {orphans.length === 1 ? "enlace huérfano" : "enlaces huérfanos"} sin episodio asignado
          </span>
        </div>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={["h-4 w-4 flex-shrink-0 text-text-muted transition-transform", open ? "rotate-180" : ""].join(" ")}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-tvt-yellow/30 px-4 py-3 space-y-3">
          <p className="text-xs text-text-secondary">
            Estos enlaces pertenecen a la serie pero quedaron sin episodio tras un
            cambio de TMDB target. Reasígnalos al episodio correcto o bórralos.
          </p>
          <div className="space-y-2">
            {orphans.map((s) => (
              <div key={s.id} className="rounded-lg bg-surface-card p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-xs text-text-secondary min-w-0">
                    <span className="font-mono text-text-muted">#{s.id}</span>
                    <span className="rounded bg-surface-overlay px-1.5 py-0.5 font-medium">
                      {s.language || "UNK"}
                    </span>
                    {s.quality && (
                      <span className="rounded bg-surface-overlay px-1.5 py-0.5">
                        {s.quality}
                      </span>
                    )}
                    {s.source_kind && (
                      <span className="text-text-muted">· {s.source_kind}</span>
                    )}
                    {s.server && !s.source_kind && (
                      <span className="text-text-muted">· {s.server}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(editing === s.id ? null : s.id)}
                      className={[
                        "rounded-md px-2 py-1 text-xs font-medium ring-1 transition-colors",
                        editing === s.id
                          ? "bg-tvt-yellow/20 text-tvt-yellow ring-tvt-yellow/50"
                          : "bg-surface-overlay text-text-secondary ring-border-subtle hover:text-tvt-yellow",
                      ].join(" ")}
                    >
                      Reasignar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`¿Borrar enlace #${s.id}? Esta acción no se puede deshacer.`)) {
                          deleteStream.mutate(s.id);
                        }
                      }}
                      disabled={deleteStream.isPending}
                      className="rounded-md bg-tvt-red/10 px-2 py-1 text-xs font-medium text-tvt-red ring-1 ring-tvt-red/30 hover:bg-tvt-red/20 disabled:opacity-50 transition-colors"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
                {editing === s.id && (
                  <ReassignStreamDialog
                    streamId={s.id}
                    seriesId={seriesId}
                    initialLanguage={s.language}
                    initialQuality={s.quality ?? ""}
                    onSuccess={() => setEditing(null)}
                    onCancel={() => setEditing(null)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
