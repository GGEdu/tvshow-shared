import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServices } from "../contexts/ServicesContext.jsx";

/**
 * F8.3 — Admin maintenance hooks (v0.11.2-ui).
 *
 * Backed by the 5 endpoints under /admin/maintenance/* introduced in
 * AgenticTVShow F8.1. Each mutation invalidates the broader admin
 * cache namespace so the reconcile pendings table refreshes after
 * sweeping stale rows, etc.
 *
 * The endpoints exist on AgenticTV only — TelegramTVShow's MergeService
 * is N/A and its catalog isn't affected by the legacy bugs F8 targets.
 * The UI's <AdminConsole/> only mounts the maintenance tab when its
 * `features` prop includes 'maintenance' (TelegramTV omits it).
 */

const QK = {
  audit: ["admin", "maintenance", "audit-stream-languages"],
};

export function useRefitMediaType() {
  const { api } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/admin/maintenance/refit-media-type"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

export function useSweepStalePendings() {
  const { api } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/admin/maintenance/sweep-stale-pendings"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "reconcile"] });
    },
  });
}

export function useRebindOrphanStreams() {
  const { api } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/admin/maintenance/rebind-orphan-streams"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

export function useAuditStreamLanguages({ enabled = true } = {}) {
  const { api } = useServices();
  return useQuery({
    queryKey: QK.audit,
    queryFn: () => api.get("/admin/maintenance/audit-stream-languages"),
    enabled,
    staleTime: 60_000,
  });
}

export function useNormalizeStreamLanguages() {
  const { api } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/admin/maintenance/normalize-stream-languages"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.audit });
    },
  });
}
