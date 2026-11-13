import { useEffect, useState } from "react";
import { useReducedMotion } from "../lib/hooks";
import { cx } from "./ui";

/** Bars that move like a voice; still when idle. */
export default function Waveform({
  active,
  tone,
  bars = 48,
  className,
}: {
  active: boolean;
  tone: "brand" | "slate" | "white";
  bars?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [heights, setHeights] = useState(() => Array.from({ length: bars }, () => 0.15));
  useEffect(() => {
    if (!active || reduced) {
      setHeights(Array.from({ length: bars }, (_, i) => 0.12 + 0.08 * Math.sin(i / 3) ** 2));
      return;
    }
    const id = window.setInterval(() => {
      setHeights(
        Array.from({ length: bars }, (_, i) => {
          const envelope = Math.sin((i / bars) * Math.PI); // louder in the middle
          return Math.max(0.1, envelope * (0.35 + Math.random() * 0.65));
        }),
      );
    }, 110);
    return () => window.clearInterval(id);
  }, [active, bars, reduced]);

  const color = { brand: "bg-brand-500", slate: "bg-slate-400", white: "bg-white/70" }[tone];
  return (
    <div className={cx("flex h-14 items-center gap-[3px]", className)} aria-hidden>
      {heights.map((h, i) => (
        <span
          key={i}
          className={cx("w-[3px] flex-1 rounded-full transition-all duration-100", color)}
          style={{ height: `${Math.round(h * 100)}%` }}
        />
      ))}
    </div>
  );
}
