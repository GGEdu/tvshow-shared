/**
 * Resolves a poster/still path to a usable image URL.
 * Legacy series store full URLs; TMDB series store relative paths;
 * locally cached posters start with /static.
 *
 * @param {string|null|undefined} path
 * @param {string} size - TMDB image size token (e.g. "w300", "w185", "w1280")
 * @returns {string|null}
 */
export function resolveImageUrl(path, size = "w300") {
  if (!path) return null;
  if (path.startsWith("http")) return path.includes("image.tmdb.org") ? path : null;
  if (path.startsWith("/static")) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
