import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServices } from "../contexts/ServicesContext.jsx";
import { queryKeys } from "../lib/queryKeys.js";

export function useTmdbSync(seriesId) {
  const { seriesService } = useServices();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (tmdbUrl) => seriesService.syncFromTmdb(seriesId, tmdbUrl),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.series.detail(String(seriesId)), updated);
      setEditing(false);
      setValue("");
    },
  });

  function startEdit() {
    setValue("");
    setEditing(true);
    mutation.reset();
  }

  function cancel() {
    setEditing(false);
    mutation.reset();
  }

  function sync() {
    if (value.trim()) mutation.mutate(value.trim());
  }

  return { editing, value, setValue, startEdit, cancel, sync, isPending: mutation.isPending, error: mutation.error };
}
