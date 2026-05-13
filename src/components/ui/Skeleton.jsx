export default function Skeleton({ className = "" }) {
  return (
    <div
      className={["rounded bg-surface-overlay animate-skeleton-pulse", className].join(" ")}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl bg-surface-card p-3">
      <Skeleton className="mb-3 aspect-[2/3] w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

export function SkeletonText({ lines = 3 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-4" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}
