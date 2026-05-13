export default function SearchInput({ value, onChange, placeholder = "Buscar...", className = "" }) {
  return (
    <div className={["relative", className].join(" ")}>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1116.65 16.65z" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl bg-surface-card py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder-text-muted outline-none ring-1 ring-border-subtle focus:ring-tvt-yellow transition-all"
      />
    </div>
  );
}
