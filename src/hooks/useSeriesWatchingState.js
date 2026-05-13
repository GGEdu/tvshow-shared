import { useCallback } from "react";
import {
  useWatchedBySeriesId,
  useMarkWatched,
  useMarkWatchedBulk,
  useUnmarkWatched,
  useUnmarkWatchedBulk,
} from "./useWatchedEpisodes.js";

/**
 * Aggregates watched state, mark, unmark, and bulk-mark/unmark for a series.
 * Single source of truth for the watching state of a series in the UI.
 *
 * @param {number} seriesId
 */
export function useSeriesWatchingState(seriesId) {
  const { data: watchedIds = new Set(), isLoading } = useWatchedBySeriesId(seriesId);
  const markWatched = useMarkWatched(seriesId);
  const unmarkWatched = useUnmarkWatched(seriesId);
  const markWatchedBulk = useMarkWatchedBulk(seriesId);
  const unmarkWatchedBulk = useUnmarkWatchedBulk(seriesId);

  const toggle = useCallback(
    (episodeId, shouldMark) => {
      if (shouldMark) {
        markWatched.mutate(episodeId);
      } else {
        unmarkWatched.mutate(episodeId);
      }
    },
    [markWatched, unmarkWatched]
  );

  const markBulk = useCallback(
    (episodeIds) => markWatchedBulk.mutate(episodeIds),
    [markWatchedBulk]
  );

  const unmarkBulk = useCallback(
    (episodeIds) => unmarkWatchedBulk.mutate(episodeIds),
    [unmarkWatchedBulk]
  );

  return { watchedIds, isLoading, toggle, markBulk, unmarkBulk };
}
