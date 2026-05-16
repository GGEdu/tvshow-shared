import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServices } from "../contexts/ServicesContext.jsx";

/**
 * Reconciler admin hooks (v0.10.0).
 *
 * Both AgenticTVShow and TelegramTVShow expose identical /admin/reconcile/*
 * endpoints (backed by tvshow-common v0.10.4). These hooks talk to them
 * via the shared `api` client from useServices() so they work against
 * either backend without conditional code.
 */

const QK = {
  pending: (limit = 50) => ["admin", "reconcile", "pending", limit],
  analytics: ["admin", "reconcile", "analytics"],
  tmdb: (q) => ["admin", "tmdb-search", q],
};

export function useReconcilePending({ limit = 50, enabled = true } = {}) {
  const { api } = useServices();
  return useQuery({
    queryKey: QK.pending(limit),
    queryFn: () => api.get(`/admin/reconcile/pending?limit=${limit}`),
    enabled,
    staleTime: 30_000,
  });
}

export function useReconcileAnalytics({ enabled = true } = {}) {
  const { api } = useServices();
  return useQuery({
    queryKey: QK.analytics,
    queryFn: () => api.get("/admin/reconcile/analytics"),
    enabled,
    staleTime: 60_000,
  });
}

export function useReconcileBulkRun() {
  const { api } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ limit, dry_run = false }) =>
      api.post("/admin/reconcile/run-full", { limit, dry_run }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "reconcile"] });
    },
  });
}

export function useReconcileAccept() {
  const { api } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pendingId, target_tmdb_id, target_season_number, kind }) =>
      api.post(`/admin/reconcile/pending/${pendingId}/accept`, {
        target_tmdb_id,
        target_season_number,
        kind,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "reconcile"] });
    },
  });
}

export function useReconcileDiscard() {
  const { api } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pendingId, reason }) =>
      api.post(`/admin/reconcile/pending/${pendingId}/discard`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "reconcile"] });
    },
  });
}

/**
 * Search TMDB via the backend proxy. Debounce the `query` upstream
 * (component-level) to avoid hammering the endpoint.
 */
export function useAdminTmdbSearch(query, { enabled = true } = {}) {
  const { api } = useServices();
  const q = (query ?? "").trim();
  return useQuery({
    queryKey: QK.tmdb(q),
    queryFn: () => api.get(`/admin/reconcile/tmdb-search?q=${encodeURIComponent(q)}`),
    enabled: enabled && q.length >= 2,
    staleTime: 5 * 60_000,
  });
}
