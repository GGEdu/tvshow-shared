export default function Card({ interactive = false, className = "", children, ...props }) {
  return (
    <div
      {...props}
      className={[
        "rounded-xl bg-surface-card",
        interactive && "cursor-pointer transition-colors duration-150 hover:bg-surface-card-hover active:scale-[0.99]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
