import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServices } from "../contexts/ServicesContext.jsx";
import { queryKeys } from "../lib/queryKeys.js";

/**
 * Trigger the backend's non-destructive TMDB retarget (v0.9.0):
 * streams are preserved, detached and remapped best-effort to the new
 * TMDB target. Unmapped streams stay orphan for manual reassignment via
 * <OrphanStreamsBanner />.
 *
 * Consumer's `seriesService` must expose:
 *   seriesService.retargetTmdb(seriesId, newTmdbId)  // POST /series/{id}/retarget-tmdb
 */
export function useRetargetTmdb(seriesId) {
  const { seriesService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (newTmdbId) => seriesService.retargetTmdb(seriesId, newTmdbId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.series.detail(String(seriesId)) });
      qc.invalidateQueries({ queryKey: queryKeys.series.seasons(String(seriesId)) });
      qc.invalidateQueries({ queryKey: ["streams", "orphan", String(seriesId)] });
    },
  });
}
