const colorMap = {
  yellow: "bg-tvt-yellow",
  green: "bg-tvt-green",
  blue: "bg-tvt-blue",
  purple: "bg-tvt-purple",
  red: "bg-tvt-red",
};

export default function ProgressBar({ value = 0, color = "yellow", className = "" }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={["h-1 w-full overflow-hidden rounded-full bg-surface-overlay", className].join(" ")}>
      <div
        className={["h-full rounded-full transition-all duration-500", colorMap[color] ?? "bg-tvt-yellow"].join(" ")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
