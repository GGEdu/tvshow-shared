// @ggedu/tvshow-ui — main entry point.
// Re-exports all UI primitives, hooks, contexts and lib utilities.

// UI primitives (full barrel)
export * from "./components/ui/index.js";

// UI primitives not in the barrel — exposed via direct paths or here:
export { default as FlagImg } from "./components/ui/FlagImg.jsx";
export { default as LanguageBadges } from "./components/ui/LanguageBadges.jsx";
export { default as PosterOverlay } from "./components/ui/PosterOverlay.jsx";

// Layout components (v0.5.0)
export { default as Layout } from "./components/Layout.jsx";
export { default as ProtectedRoute } from "./components/ProtectedRoute.jsx";

// Domain UI components (v0.6.0)
export { default as SeriesHero } from "./components/SeriesHero.jsx";
export {
  default as EpisodeRow,
  LANG_META,
  getLangMeta,
} from "./components/EpisodeRow.jsx";
export { default as SeasonAccordion } from "./components/SeasonAccordion.jsx";

// Library utilities
export * from "./lib/constants.js";
export * from "./lib/image.js";
export * from "./lib/languages.js";
export * from "./lib/queryKeys.js";

// Contexts (v0.4.0)
export {
  ServicesContext,
  ServicesProvider,
  useServices,
} from "./contexts/ServicesContext.jsx";
export { AuthContext, AuthProvider } from "./contexts/AuthContext.jsx";

// Hooks (v0.4.0) — all read services via useServices()
export { useAuth } from "./hooks/useAuth.js";
export { useUser } from "./hooks/useUser.js";
export {
  useMyLists,
  useAddToList,
  useUpdateList,
  useRemoveFromList,
} from "./hooks/useLists.js";
export { useFollowSeries } from "./hooks/useFollowSeries.js";
export { useListDropdown } from "./hooks/useListDropdown.js";
export { useSeasonEpisodes } from "./hooks/useSeasonEpisodes.js";
export {
  useWatchedBySeriesId,
  useMarkWatched,
  useMarkWatchedBulk,
  useUnmarkWatched,
  useUnmarkWatchedBulk,
} from "./hooks/useWatchedEpisodes.js";
export { useSeriesWatchingState } from "./hooks/useSeriesWatchingState.js";
export { useTmdbSync } from "./hooks/useTmdbSync.js";
