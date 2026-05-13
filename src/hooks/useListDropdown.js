import { useState } from "react";
import { useMyLists, useAddToList, useUpdateList, useRemoveFromList } from "./useLists.js";

/**
 * Encapsulates the state and mutation logic for a series list membership dropdown.
 * Keeps ListDropdown UI component free of direct mutation orchestration.
 */
export function useListDropdown(seriesId) {
  const [open, setOpen] = useState(false);
  const { data: myLists = [] } = useMyLists();
  const addToList = useAddToList();
  const updateList = useUpdateList();
  const removeFromList = useRemoveFromList();

  const entry = myLists.find((e) => e.series_id === seriesId);
  const currentType = entry?.list_type;
  const isLoading = addToList.isPending || updateList.isPending || removeFromList.isPending;

  function select(listType) {
    setOpen(false);
    if (currentType === listType) {
      removeFromList.mutate({ listId: entry.id });
    } else if (entry) {
      updateList.mutate({ listId: entry.id, listType });
    } else {
      addToList.mutate({ seriesId, listType });
    }
  }

  function remove() {
    setOpen(false);
    removeFromList.mutate({ listId: entry.id });
  }

  return { open, setOpen, currentType, isLoading, select, remove };
}
