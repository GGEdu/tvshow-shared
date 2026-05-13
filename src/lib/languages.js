/**
 * Mapping from raw `episode_streams.language` values (as the spider stores
 * them) to a country code (cc) — used by flagcdn.com for SVG flag images —
 * plus a short label for accessibility.
 *
 * Used by EpisodeRow (large round flag), LanguageBadges (inline chip), and
 * PosterOverlay (poster corner overlay). Single source of truth.
 *
 * Spider raw values seen in production:
 *   "es", "mx", "castellano", "latino", "español castellano",
 *   "sub español", "japonés", "ingles", "OTROS (EN)",
 *   "OTROS (AUDIO_CHINO_-_SUB_ESPAÑOL)", "NETUTOP"…
 *
 * Anything not mappable to a real flag (server names, junk strings) returns
 * cc=null and is filtered out by `normalizeLanguages` so the UI shows only
 * real flags — no text fallbacks polluting the cards.
 */

export const LANG_META = {
  // Spanish — Spain
  es: { cc: "es", short: "ESP", title: "Español castellano" },
  esp: { cc: "es", short: "ESP", title: "Español castellano" },
  castellano: { cc: "es", short: "CAS", title: "Español castellano" },
  "español castellano": { cc: "es", short: "CAS", title: "Español castellano" },
  español: { cc: "es", short: "ESP", title: "Español" },
  spain: { cc: "es", short: "ESP", title: "Español" },

  // Spanish — Latin America (proxied as Mexico, source of most LAT dubs)
  mx: { cc: "mx", short: "LAT", title: "Español latino" },
  lat: { cc: "mx", short: "LAT", title: "Español latino" },
  latino: { cc: "mx", short: "LAT", title: "Español latino" },
  latinoamerica: { cc: "mx", short: "LAT", title: "Español latino" },
  "español latino": { cc: "mx", short: "LAT", title: "Español latino" },

  // Subtitled (assumed Japanese audio with Spanish subs in this catalogue)
  sub: { cc: "jp", short: "SUB", title: "Subtitulado" },
  subs: { cc: "jp", short: "SUB", title: "Subtitulado" },
  subtitulado: { cc: "jp", short: "SUB", title: "Subtitulado" },
  subtitulos: { cc: "jp", short: "SUB", title: "Subtitulado" },
  "sub español": { cc: "jp", short: "SUB", title: "Subtitulado en español" },
  "sub esp": { cc: "jp", short: "SUB", title: "Subtitulado en español" },

  // Japanese
  jp: { cc: "jp", short: "JAP", title: "Japonés" },
  ja: { cc: "jp", short: "JAP", title: "Japonés" },
  japones: { cc: "jp", short: "JAP", title: "Japonés" },
  "japonés": { cc: "jp", short: "JAP", title: "Japonés" },
  japanese: { cc: "jp", short: "JAP", title: "Japonés" },

  // English
  en: { cc: "gb", short: "ENG", title: "Inglés" },
  english: { cc: "gb", short: "ENG", title: "Inglés" },
  ingles: { cc: "gb", short: "ENG", title: "Inglés" },
  "inglés": { cc: "gb", short: "ENG", title: "Inglés" },

  // Portuguese
  portugues: { cc: "br", short: "POR", title: "Portugués" },
  "português": { cc: "br", short: "POR", title: "Portugués" },

  // French
  frances: { cc: "fr", short: "FRA", title: "Francés" },
  "francés": { cc: "fr", short: "FRA", title: "Francés" },

  // German
  aleman: { cc: "de", short: "ALE", title: "Alemán" },
  "alemán": { cc: "de", short: "ALE", title: "Alemán" },
};

/**
 * Resolve a raw language string to display metadata.
 * Returns `{ cc: null, ... }` for unknown values — caller decides whether
 * to show or hide them.
 *
 * @param {string} lang
 * @returns {{ cc: string | null, short: string, title: string, raw: string }}
 */
function _normKey(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // Underscores / dashes inside spider raw values like
    // "OTROS (AUDIO_CHINO_-_SUB_ESPAÑOL)" become spaces so substring
    // matching against keys with literal spaces ("sub espanol") works.
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Pre-build a normalized lookup table once so fuzzy matching is consistent
// (handles "español" vs "espanol" both as keys and inputs).
const NORM_LANG_META = (() => {
  const out = {};
  for (const [k, v] of Object.entries(LANG_META)) {
    out[_normKey(k)] = v;
  }
  return out;
})();

export function getLangMeta(lang) {
  const key = _normKey(lang);

  // Empty / blank input → no flag (avoid every key.includes("") = true).
  if (!key) {
    return { cc: null, short: "", title: lang || "", raw: lang, label: lang };
  }

  // Exact match against the normalized table.
  if (NORM_LANG_META[key]) {
    return { ...NORM_LANG_META[key], raw: lang, label: lang };
  }

  // Substring match — only for keys ≥ 4 chars to avoid "es" matching inside
  // unrelated words like "OTROS (...)" or server names.
  let best = null;
  for (const k of Object.keys(NORM_LANG_META)) {
    if (k.length < 4) continue;
    if (key.includes(k) || k.includes(key)) {
      if (!best || k.length > best.length) best = k;
    }
  }
  if (best) return { ...NORM_LANG_META[best], raw: lang, label: lang };

  return { cc: null, short: "", title: lang || "", raw: lang, label: lang };
}

/**
 * Take a list of raw language strings, dedupe by country code, drop unknown
 * values (no flag → not shown), preserve first-seen order.
 *
 * @param {string[]} languages
 * @returns {{ cc: string, short: string, title: string }[]}
 */
export function normalizeLanguages(languages) {
  const seen = new Map();
  for (const raw of languages || []) {
    const meta = getLangMeta(raw);
    if (!meta.cc) continue; // hide unknown / junk values
    if (!seen.has(meta.cc)) seen.set(meta.cc, meta);
  }
  return [...seen.values()];
}
