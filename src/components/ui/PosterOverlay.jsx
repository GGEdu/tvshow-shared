import { normalizeLanguages } from "../../lib/languages.js";
import FlagImg from "./FlagImg.jsx";

/**
 * Top-left corner overlay for posters in Discover. Shows small round
 * flag chips for known languages + a colored coverage % chip.
 *
 * Unknown raw values (server names, junk) are silently dropped.
 *
 * Designed to overlay an absolutely-positioned <img>; the parent must
 * have `position: relative`.
 */

function _coverageColor(pct) {
  if (pct === 100) return "bg-tvt-green/90 text-white";
  if (pct >= 75) return "bg-tvt-yellow/90 text-surface-base";
  if (pct >= 25) return "bg-orange-500/90 text-white";
  return "bg-tvt-red/90 text-white";
}

export default function PosterOverlay({ languages, coveragePct }) {
  const langs = normalizeLanguages(languages);
  const showCoverage = typeof coveragePct === "number" && coveragePct > 0;

  if (langs.length === 0 && !showCoverage) return null;

  return (
    <div className="pointer-events-none absolute left-1.5 top-1.5 flex flex-col items-start gap-1">
      {langs.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {langs.map((meta) => (
            <span
              key={meta.cc}
              title={meta.title}
              className="block h-5 w-5 overflow-hidden rounded-full ring-1 ring-black/40 shadow-sm"
            >
              <FlagImg cc={meta.cc} label={meta.title} />
            </span>
          ))}
        </div>
      )}
      {showCoverage && (
        <span
          title={`${coveragePct}% de capítulos con stream`}
          className={[
            "rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none shadow-sm",
            _coverageColor(coveragePct),
          ].join(" ")}
        >
          {coveragePct}%
        </span>
      )}
    </div>
  );
}
