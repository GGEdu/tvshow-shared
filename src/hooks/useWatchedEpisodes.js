import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServices } from "../contexts/ServicesContext.jsx";
import { queryKeys } from "../lib/queryKeys.js";

export function useWatchedBySeriesId(seriesId) {
  const { api } = useServices();
  return useQuery({
    queryKey: queryKeys.series.watched(seriesId),
    queryFn: async () => {
      const ids = await api.get(`/series/${seriesId}/watched`);
      return new Set(ids);
    },
    enabled: !!seriesId,
  });
}

function useOptimisticWatchMutation(seriesId, mutationFn, applyOptimistic) {
  const queryClient = useQueryClient();
  const watchedKey = queryKeys.series.watched(seriesId);

  return useMutation({
    mutationFn,
    onMutate: async (episodeId) => {
      await queryClient.cancelQueries({ queryKey: watchedKey });
      const previous = queryClient.getQueryData(watchedKey);
      queryClient.setQueryData(watchedKey, (old = new Set()) => {
        const next = new Set(old);
        applyOptimistic(next, episodeId);
        return next;
      });
      return { previous };
    },
    onError: (_err, _episodeId, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(watchedKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: watchedKey });
    },
  });
}

export function useMarkWatched(seriesId) {
  const { api } = useServices();
  return useOptimisticWatchMutation(
    seriesId,
    (episodeId) => api.post("/episodes/watched", { episode_id: episodeId }),
    (set, id) => set.add(id),
  );
}

export function useMarkWatchedBulk(seriesId) {
  const { api } = useServices();
  const queryClient = useQueryClient();
  const watchedKey = queryKeys.series.watched(seriesId);

  return useMutation({
    mutationFn: (episodeIds) => api.post("/episodes/watched/bulk", { episode_ids: episodeIds }),
    onMutate: async (episodeIds) => {
      await queryClient.cancelQueries({ queryKey: watchedKey });
      const previous = queryClient.getQueryData(watchedKey);
      queryClient.setQueryData(watchedKey, (old = new Set()) => {
        const next = new Set(old);
        episodeIds.forEach((id) => next.add(id));
        return next;
      });
      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(watchedKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: watchedKey });
    },
  });
}

export function useUnmarkWatched(seriesId) {
  const { api } = useServices();
  return useOptimisticWatchMutation(
    seriesId,
    (episodeId) => api.delete(`/episodes/watched/${episodeId}`),
    (set, id) => set.delete(id),
  );
}

export function useUnmarkWatchedBulk(seriesId) {
  const { api } = useServices();
  const queryClient = useQueryClient();
  const watchedKey = queryKeys.series.watched(seriesId);

  return useMutation({
    mutationFn: (episodeIds) =>
      api.post("/episodes/watched/bulk-unmark", { episode_ids: episodeIds }),
    onMutate: async (episodeIds) => {
      await queryClient.cancelQueries({ queryKey: watchedKey });
      const previous = queryClient.getQueryData(watchedKey);
      queryClient.setQueryData(watchedKey, (old = new Set()) => {
        const next = new Set(old);
        for (const id of episodeIds) next.delete(id);
        return next;
      });
      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(watchedKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: watchedKey });
    },
  });
}
