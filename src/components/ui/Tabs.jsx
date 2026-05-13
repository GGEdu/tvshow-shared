export default function Tabs({ tabs, activeKey, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border-subtle pb-0 scrollbar-none">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={[
            "shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150 -mb-px",
            activeKey === tab.key
              ? "border-tvt-yellow text-tvt-yellow"
              : "border-transparent text-text-secondary hover:text-text-primary",
          ].join(" ")}
        >
          {tab.label}
          {tab.count != null && (
            <span className="ml-1.5 rounded-full bg-surface-overlay px-1.5 py-0.5 text-xs">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
