import { useMyLists, useAddToList, useRemoveFromList, useUpdateList } from "./useLists.js";

export function useFollowSeries(seriesId) {
  const { data: myLists = [] } = useMyLists();
  const addToList = useAddToList();
  const removeFromList = useRemoveFromList();
  const updateList = useUpdateList();

  const entry = myLists.find((e) => e.series_id === seriesId);
  const isFollowing = !!entry;
  const isArchived = entry?.list_type === "archived";
  const isLoading = addToList.isPending || removeFromList.isPending || updateList.isPending;

  function follow() {
    addToList.mutate({ seriesId, listType: "watching" });
  }

  function unfollow() {
    if (entry) removeFromList.mutate({ listId: entry.id });
  }

  function archive() {
    if (!entry) {
      addToList.mutate({ seriesId, listType: "archived" });
    } else if (entry.list_type !== "archived") {
      updateList.mutate({ listId: entry.id, listType: "archived" });
    }
  }

  function unarchive() {
    if (entry) updateList.mutate({ listId: entry.id, listType: "watching" });
  }

  return { isFollowing, isArchived, isLoading, follow, unfollow, archive, unarchive };
}
