import { useState } from "react";
import {
  useAuditStreamLanguages,
  useNormalizeStreamLanguages,
  useRebindOrphanStreams,
  useRefitMediaType,
  useSweepStalePendings,
} from "../../hooks/useMaintenance.js";

/**
 * F8.3 v0.11.2-ui — Maintenance tab.
 *
 * Surfaces the 5 endpoints in /admin/maintenance/* as four action cards
 * + one inline audit panel. Each card shows a one-line description, a
 * single-action button, and the most recent run's JSON summary.
 *
 * Mounted by <AdminConsole/> when 'maintenance' is in the `features`
 * prop. AgenticTV passes it; TelegramTV doesn't (the endpoints don't
 * exist there).
 */

export default function MaintenanceTab() {
  return (
    <div className="space-y-4">
      <RefitMediaTypeCard />
      <SweepStalePendingsCard />
      <RebindOrphanStreamsCard />
      <StreamLanguagesPanel />
    </div>
  );
}

// ─── Refit ───────────────────────────────────────────────────────────

function RefitMediaTypeCard() {
  const m = useRefitMediaType();
  const r = m.data ?? null;
  return (
    <ActionCard
      title="Refit media_type"
      description={
        "Re-clasifica series con tmdb_sync_status='error': prueba /movie/{id}, " +
        "si responde 200 cambia tmdb_media_type a 'movie' y refresca poster/overview. " +
        "Series cuyo id no existe ni en /tv ni en /movie quedan marcadas 'unrecoverable'."
      }
      action="Ejecutar"
      onConfirm={(cb) => {
        const ok = window.confirm(
          "Esto consulta TMDB y modifica series con tmdb_sync_status='error'. ¿Continuar?"
        );
        if (ok) m.mutate(undefined, { onSettled: cb });
        else cb?.();
      }}
      pending={m.isPending}
      error={m.error}
    >
      {r && (
        <SummaryGrid
          items={[
            { label: "Procesadas", value: r.total_processed },
            { label: "→ Movie", value: r.switched_to_movie, tint: "emerald" },
            { label: "TV (OK)", value: r.confirmed_tv, tint: "sky" },
            { label: "Irrecuperables", value: r.still_broken, tint: "red" },
          ]}
        />
      )}
    </ActionCard>
  );
}

// ─── Sweep stale ─────────────────────────────────────────────────────

function SweepStalePendingsCard() {
  const m = useSweepStalePendings();
  const r = m.data ?? null;
  return (
    <ActionCard
      title="Cerrar pendings stale"
      description={
        "UPDATE idempotente: marca como 'resolved' las filas de reconcile_pending " +
        "cuya serie ya tiene tmdb_id asignado (auto-applies pre-F8.2 que no se cerraron)."
      }
      action="Ejecutar"
      onConfirm={(cb) => m.mutate(undefined, { onSettled: cb })}
      pending={m.isPending}
      error={m.error}
    >
      {r && <SummaryGrid items={[{ label: "Cerradas", value: r.swept, tint: "emerald" }]} />}
    </ActionCard>
  );
}

// ─── Rebind orphans ──────────────────────────────────────────────────

function RebindOrphanStreamsCard() {
  const m = useRebindOrphanStreams();
  const r = m.data ?? null;
  return (
    <ActionCard
      title="Re-pegar streams huérfanos"
      description={
        "UPDATE episode_streams SET series_id desde la cadena episode→season→series " +
        "para los streams con series_id=NULL pero episode_id válido."
      }
      action="Ejecutar"
      onConfirm={(cb) => m.mutate(undefined, { onSettled: cb })}
      pending={m.isPending}
      error={m.error}
    >
      {r && <SummaryGrid items={[{ label: "Re-pegados", value: r.rebound, tint: "emerald" }]} />}
    </ActionCard>
  );
}

// ─── Stream languages: audit + normalize combo ───────────────────────

function StreamLanguagesPanel() {
  const [auditEnabled, setAuditEnabled] = useState(false);
  const audit = useAuditStreamLanguages({ enabled: auditEnabled });
  const normalize = useNormalizeStreamLanguages();

  return (
    <div className="rounded-xl bg-surface-overlay p-4 ring-1 ring-surface-border space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-text-primary">
          Idioma corrupto en episode_streams
        </h3>
        <p className="text-xs text-text-muted leading-relaxed">
          Algunos streams llevan un host (streamtape.com, netutop, …) en la columna{" "}
          <code>language</code> por un bug viejo del receiver. Audita primero; si el conteo cuadra,
          normaliza a 'Unknown' para que el Walk re-popule el idioma real en la próxima pasada.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAuditEnabled(true)}
          disabled={audit.isFetching}
          className="rounded-lg bg-surface-base px-3 py-1.5 text-xs text-text-primary ring-1 ring-surface-border hover:bg-tvt-yellow/10 disabled:opacity-50"
        >
          {audit.isFetching ? "Auditando…" : "Auditar"}
        </button>

        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                "Esto cambia language='Unknown' en las filas sospechosas. " +
                  "Idempotente — la próxima ingest sobrescribirá. ¿Continuar?"
              )
            ) {
              normalize.mutate(undefined, {
                onSuccess: () => setAuditEnabled(true),
              });
            }
          }}
          disabled={normalize.isPending}
          className="rounded-lg bg-tvt-yellow px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
        >
          {normalize.isPending ? "Normalizando…" : "Normalizar a 'Unknown'"}
        </button>
      </div>

      {normalize.data && (
        <SummaryGrid
          items={[{ label: "Normalizadas", value: normalize.data.normalized, tint: "emerald" }]}
        />
      )}

      {audit.data && (
        <div className="space-y-2 text-xs">
          <div className="rounded bg-surface-base p-2 ring-1 ring-surface-border">
            <span className="text-text-muted">Sospechosas (host en lang): </span>
            <span className="text-text-primary font-medium">{audit.data.suspect_count}</span>
          </div>
          {audit.data.distribution?.length > 0 && (
            <div className="overflow-x-auto rounded-lg ring-1 ring-surface-border">
              <table className="min-w-full text-[11px]">
                <thead className="bg-surface-base text-text-muted">
                  <tr>
                    <th className="px-2 py-1 text-left">language</th>
                    <th className="px-2 py-1 text-right">n</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {audit.data.distribution.slice(0, 12).map((d) => (
                    <tr key={d.language ?? "(null)"}>
                      <td className="px-2 py-1 font-mono text-text-primary">
                        {d.language ?? "(null)"}
                      </td>
                      <td className="px-2 py-1 text-right text-text-muted">{d.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(audit.isError || normalize.isError) && (
        <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/30">
          {(audit.error ?? normalize.error)?.message ?? "fallo"}
        </div>
      )}
    </div>
  );
}

// ─── Reusable cards ─────────────────────────────────────────────────

function ActionCard({ title, description, action, onConfirm, pending, error, children }) {
  function handle() {
    onConfirm?.(() => {});
  }
  return (
    <div className="rounded-xl bg-surface-overlay p-4 ring-1 ring-surface-border space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <p className="text-xs text-text-muted leading-relaxed">{description}</p>
      </div>
      <button
        type="button"
        onClick={handle}
        disabled={pending}
        className="rounded-lg bg-tvt-yellow px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Ejecutando…" : action}
      </button>
      {error && (
        <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/30">
          {error?.message ?? "fallo"}
        </div>
      )}
      {children}
    </div>
  );
}

function SummaryGrid({ items }) {
  const TINTS = {
    emerald: "text-emerald-300",
    sky: "text-sky-300",
    red: "text-red-300",
  };
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg bg-surface-base p-3 text-xs ring-1 ring-surface-border">
      {items.map((it) => (
        <div key={it.label}>
          <div className="text-text-muted">{it.label}</div>
          <div className={`font-semibold ${TINTS[it.tint] ?? "text-text-primary"}`}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}
