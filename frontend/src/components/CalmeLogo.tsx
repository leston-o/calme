import { cx } from "./ui";

/**
 * The CalMe mark: a C with a voice wave that settles into a calm, flat line.
 * Keep in sync with public/favicon.svg.
 */
export function CalmeMark({ dark, className }: { dark?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cx("calme-mark shrink-0", className)} aria-hidden="true">
      <path
        d="M46.1 17.9 A20 20 0 1 0 46.1 46.1"
        stroke={dark ? "#ffffff" : "#0f172a"}
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        className="calme-wave"
        d="M21 32 q3 -10 6 0 q3 7 6 0 q3 -3.5 6 0 L56 32"
        stroke={dark ? "#60a5fa" : "#3b82f6"}
        strokeWidth="3.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
      />
    </svg>
  );
}

/** Mark plus the CalMe wordmark. */
export default function CalmeLogo({ dark, className }: { dark?: boolean; className?: string }) {
  return (
    <span className={cx("group/logo flex items-center gap-2", className)}>
      <CalmeMark dark={dark} className="size-8" />
      <span className={cx("font-display text-2xl leading-none", dark ? "text-white" : "text-slate-950")}>CalMe</span>
    </span>
  );
}
