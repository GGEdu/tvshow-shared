import { useState } from "react";
import AnalyticsTab from "./AnalyticsTab.jsx";
import MaintenanceTab from "./MaintenanceTab.jsx";
import ReconcileTab from "./ReconcileTab.jsx";

/**
 * v0.10.0 — Shared admin console for both AgenticTV and TelegramTV.
 * v0.11.2-ui adds the 'maintenance' tab (F8.3) backed by the new
 * /admin/maintenance/* endpoints. Only AgenticTV mounts it — TelegramTV's
 * MergeService doesn't exist, so the operations are N/A there.
 *
 * Props:
 *   - features: array of tab keys to show. Default ["reconcile","analytics"].
 *     Recognised keys: "reconcile" | "analytics" | "urls" | "walk" | "maintenance".
 *     Unknown keys are ignored. Order in the array drives tab order.
 *
 * AgenticTV mounts:
 *   <AdminConsole features={['reconcile','analytics','urls','walk','maintenance']} />
 *
 * TelegramTV mounts:
 *   <AdminConsole features={['reconcile','analytics']} />
 */
const TAB_LABELS = {
  reconcile: "Series",
  analytics: "Analytics",
  urls: "URLs",
  walk: "Walk",
  maintenance: "Mantenimiento",
};

const KNOWN_TABS = new Set(Object.keys(TAB_LABELS));

export default function AdminConsole({ features = ["reconcile", "analytics"], initialTab }) {
  const tabs = features.filter((f) => KNOWN_TABS.has(f));
  const [active, setActive] = useState(initialTab ?? tabs[0] ?? "reconcile");
  // Reasoning filter: set by AnalyticsTab, consumed by ReconcileTab.
  const [reasoningFilter, setReasoningFilter] = useState(null);

  function handleSelectReasoning(reasoning) {
    setReasoningFilter(reasoning);
    setActive("reconcile");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Admin · Reconcile</h1>
      </div>

      <div className="flex gap-1 rounded-lg bg-surface-overlay p-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActive(t)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              active === t ? "bg-tvt-yellow text-black" : "text-text-primary hover:bg-surface-base"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {active === "reconcile" && (
        <ReconcileTab
          filterReasoning={reasoningFilter}
          onClearReasoningFilter={() => setReasoningFilter(null)}
        />
      )}
      {active === "analytics" && <AnalyticsTab onSelectReasoning={handleSelectReasoning} />}
      {active === "urls" && <PlaceholderTab label="URL Discovery" />}
      {active === "walk" && <PlaceholderTab label="Walk dashboard" />}
      {active === "maintenance" && <MaintenanceTab />}
    </div>
  );
}

function PlaceholderTab({ label }) {
  return (
    <div className="rounded-xl bg-surface-overlay p-6 text-center text-sm text-text-muted ring-1 ring-surface-border">
      {label} · próximamente
    </div>
  );
}
