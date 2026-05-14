import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServices } from "../contexts/ServicesContext.jsx";
import { queryKeys } from "../lib/queryKeys.js";

/**
 * Hooks for stream admin operations introduced in v0.9.0.
 *
 * The consumer app's `services` (passed to <ServicesProvider>) must expose
 * a `streamsService` with this shape:
 *
 *   streamsService = {
 *     reassign: (streamId, body)   => api.patch(`/streams/${streamId}`, body),
 *     remove:   (streamId)         => api.delete(`/streams/${streamId}`),
 *     listOrphans: (seriesId)      => api.get(`/series/${seriesId}/orphan-streams`),
 *   }
 *
 * The hooks read the service via useServices() so DI stays consistent with
 * the rest of @ggedu/tvshow-ui.
 */

function orphanKey(seriesId) {
  return ["streams", "orphan", String(seriesId)];
}

export function useOrphanStreams(seriesId) {
  const { streamsService } = useServices();
  return useQuery({
    queryKey: orphanKey(seriesId),
    queryFn: () => streamsService.listOrphans(seriesId),
    enabled: !!seriesId,
    staleTime: 30 * 1000,
  });
}

export function useReassignStream({ seriesId } = {}) {
  const { streamsService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ streamId, body }) => streamsService.reassign(streamId, body),
    onSuccess: (_data, vars) => {
      if (seriesId) qc.invalidateQueries({ queryKey: orphanKey(seriesId) });
      // Invalidate episode stream lists liberally — cheap and avoids stale UI
      qc.invalidateQueries({ queryKey: ["streams"] });
      qc.invalidateQueries({ queryKey: queryKeys.series.all });
      if (vars?.invalidate) {
        for (const key of vars.invalidate) qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export function useDeleteStream({ seriesId } = {}) {
  const { streamsService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (streamId) => streamsService.remove(streamId),
    onSuccess: () => {
      if (seriesId) qc.invalidateQueries({ queryKey: orphanKey(seriesId) });
      qc.invalidateQueries({ queryKey: ["streams"] });
    },
  });
}
