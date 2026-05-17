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

// HTTP client (v0.7.0)
export { api } from "./services/api.js";

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

// Stream admin (v0.9.0)
export {
  useOrphanStreams,
  useReassignStream,
  useDeleteStream,
} from "./hooks/useStreamActions.js";
export { useRetargetTmdb } from "./hooks/useRetargetTmdb.js";

export { default as RetargetTmdbDialog } from "./components/admin/RetargetTmdbDialog.jsx";
export { default as ReassignStreamDialog } from "./components/admin/ReassignStreamDialog.jsx";
export { default as OrphanStreamsBanner } from "./components/admin/OrphanStreamsBanner.jsx";

// Reconcile admin (v0.10.0) — analytics + TMDB-search + pending workflow
export {
  useReconcilePending,
  useReconcileAnalytics,
  useReconcileBulkRun,
  useReconcileAccept,
  useReconcileDiscard,
  useAdminTmdbSearch,
} from "./hooks/useReconcile.js";

export { default as AdminConsole } from "./components/admin/AdminConsole.jsx";
export { default as ReconcileTab } from "./components/admin/ReconcileTab.jsx";
export { default as ReconcileBulkRunButton } from "./components/admin/ReconcileBulkRunButton.jsx";
export { default as ReconcilePendingTable } from "./components/admin/ReconcilePendingTable.jsx";
export { default as ReconcileAcceptDialog } from "./components/admin/ReconcileAcceptDialog.jsx";
export { default as TmdbSearchSelector } from "./components/admin/TmdbSearchSelector.jsx";
export { default as AnalyticsTab } from "./components/admin/AnalyticsTab.jsx";

// Maintenance admin (v0.11.2-ui, F8.3) — AgenticTV-only endpoints
export {
  useRefitMediaType,
  useSweepStalePendings,
  useRebindOrphanStreams,
  useAuditStreamLanguages,
  useNormalizeStreamLanguages,
} from "./hooks/useMaintenance.js";
export { default as MaintenanceTab } from "./components/admin/MaintenanceTab.jsx";
