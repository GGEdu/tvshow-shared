// @ggedu/tvshow-ui — main entry point.
// Re-exports all UI primitives and lib utilities for convenience.

// UI primitives (full barrel)
export * from "./components/ui/index.js";

// UI primitives not in the barrel — exposed via direct paths or here:
export { default as FlagImg } from "./components/ui/FlagImg.jsx";
export { default as LanguageBadges } from "./components/ui/LanguageBadges.jsx";
export { default as PosterOverlay } from "./components/ui/PosterOverlay.jsx";

// Library utilities
export * from "./lib/constants.js";
export * from "./lib/image.js";
export * from "./lib/languages.js";
export * from "./lib/queryKeys.js";
