import { useState } from "react";
import ReconcileBulkRunButton from "./ReconcileBulkRunButton.jsx";
import ReconcilePendingTable from "./ReconcilePendingTable.jsx";

/**
 * v0.10.0 — Reconcile tab.
 *
 * Composes the bulk-run controls with the pending-rows table. Accepts
 * an external `filterReasoning` prop driven by <AnalyticsTab/> (the
 * <AdminConsole/> wires that through when the admin clicks a reasoning
 * group).
 */
export default function ReconcileTab({ filterReasoning, onClearReasoningFilter }) {
  const [localFilter, setLocalFilter] = useState(null);
  const effectiveFilter = filterReasoning ?? localFilter;

  function handleClear() {
    setLocalFilter(null);
    onClearReasoningFilter?.();
  }

  return (
    <div className="space-y-4">
      <ReconcileBulkRunButton />
      <ReconcilePendingTable filterReasoning={effectiveFilter} onClearFilter={handleClear} />
    </div>
  );
}
