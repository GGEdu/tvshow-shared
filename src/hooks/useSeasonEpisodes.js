import { useQuery } from "@tanstack/react-query";
import { useServices } from "../contexts/ServicesContext.jsx";
import { queryKeys } from "../lib/queryKeys.js";

/**
 * Fetches episodes for a season. Always enabled so progress can be shown
 * in the collapsed accordion header.
 *
 * @param {number} seasonId
 */
export function useSeasonEpisodes(seasonId) {
  const { seriesService } = useServices();
  return useQuery({
    queryKey: queryKeys.episodes.bySeason(seasonId),
    queryFn: () => seriesService.getEpisodes(seasonId),
    enabled: !!seasonId,
  });
}
