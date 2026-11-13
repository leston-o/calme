import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";
import { useReducedMotion } from "../../lib/hooks";

/** True once the element has scrolled into view (and stays true). */
export function useInView<T extends Element>(threshold = 0.25) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === "undefined") return setInView(true);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, inView]);
  return [ref, inView] as const;
}

/** Fades its children in as they scroll into view. `index` staggers siblings. */
export function Reveal({
  as: Tag = "div",
  variant = "up",
  index = 0,
  className,
  style,
  children,
}: {
  as?: ElementType;
  variant?: "up" | "blur" | "scale" | "left";
  index?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [ref, inView] = useInView<HTMLElement>(0.15);
  return (
    <Tag
      ref={ref}
      data-reveal={variant}
      className={[className, inView && "is-in"].filter(Boolean).join(" ")}
      style={{ ...style, "--i": index } as CSSProperties}
    >
      {children}
    </Tag>
  );
}

/** Counts smoothly to `value` whenever it changes. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduced) return setShown(value);
    const start = performance.now();
    const a = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 600);
      const eased = 1 - (1 - t) ** 3;
      const v = Math.round(a + (value - a) * eased);
      setShown(v);
      from.current = v;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return <span className={className}>{shown.toLocaleString()}</span>;
}
