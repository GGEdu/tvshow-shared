import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServices } from "../contexts/ServicesContext.jsx";
import { queryKeys } from "../lib/queryKeys.js";

export function useMyLists() {
  const { listsService } = useServices();
  return useQuery({
    queryKey: queryKeys.lists.mine(),
    queryFn: listsService.getMyLists,
  });
}

export function useAddToList() {
  const { listsService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ seriesId, listType }) => listsService.addToList(seriesId, listType),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.lists.mine() }),
  });
}

export function useUpdateList() {
  const { listsService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, listType }) => listsService.updateList(listId, listType),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.lists.mine() }),
  });
}

export function useRemoveFromList() {
  const { listsService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId }) => listsService.removeFromList(listId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.lists.mine() }),
  });
}
