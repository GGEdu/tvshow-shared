import { normalizeLanguages } from "../../lib/languages.js";
import FlagImg from "./FlagImg.jsx";

/**
 * Small round flag chips, used in season accordion headers and the
 * Home/Profile compact list view.
 *
 * Unknown raw values (server names, junk strings) are silently dropped.
 */
export default function LanguageBadges({ languages, className = "" }) {
  const items = normalizeLanguages(languages);
  if (items.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {items.map((meta) => (
        <span
          key={meta.cc}
          title={meta.title}
          className="block h-5 w-5 overflow-hidden rounded-full ring-1 ring-border-subtle"
        >
          <FlagImg cc={meta.cc} label={meta.title} />
        </span>
      ))}
    </div>
  );
}
