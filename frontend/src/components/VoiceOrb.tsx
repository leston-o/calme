import { useEffect, useRef } from "react";
import type { CallStatus } from "../lib/useLiveCall";
import { cx } from "./ui";

type Rgb = [number, number, number];

// Three glowing blobs drift inside the sphere; each state has its own colours and pace.
const LOOK: Record<CallStatus, { colors: [Rgb, Rgb, Rgb]; speed: number; glow: Rgb }> = {
  idle: { colors: [[147, 197, 253], [191, 219, 254], [196, 181, 253]], speed: 0.25, glow: [59, 130, 246] },
  connecting: { colors: [[147, 197, 253], [165, 180, 252], [191, 219, 254]], speed: 0.6, glow: [99, 102, 241] },
  listening: { colors: [[59, 130, 246], [34, 211, 238], [147, 197, 253]], speed: 0.5, glow: [37, 99, 235] },
  thinking: { colors: [[139, 92, 246], [99, 102, 241], [192, 132, 252]], speed: 1.1, glow: [124, 58, 237] },
  speaking: { colors: [[37, 99, 235], [139, 92, 246], [56, 189, 248]], speed: 0.8, glow: [37, 99, 235] },
};

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as Rgb;
const rgba = (c: Rgb, a: number) => `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`;

/** An animated sphere that shows what the assistant is doing and pulses with the voice. */
export default function VoiceOrb({
  status,
  level,
  className,
}: {
  status: CallStatus;
  /** 0–1: how loud the current speaker is. */
  level: number;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const shadow = useRef<HTMLSpanElement>(null);
  // The draw loop reads these refs so it never restarts on state changes.
  const target = useRef({ status, level });
  target.current = { status, level };

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let t = 0;
    let last = performance.now();
    let level = 0;
    let colors = LOOK.idle.colors.map((c) => [...c] as Rgb);
    let glow = [...LOOK.idle.glow] as Rgb;
    let speed = LOOK.idle.speed;

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const look = LOOK[target.current.status];
      // ease towards the current state so changes blend instead of jumping
      const k = 1 - Math.exp(-dt * 6);
      colors = colors.map((c, i) => mix(c, look.colors[i], k));
      glow = mix(glow, look.glow, k);
      speed += (look.speed - speed) * k;
      level += (target.current.level - level) * (1 - Math.exp(-dt * 14));
      if (!still) t += dt * speed;

      const dpr = window.devicePixelRatio || 1;
      const size = el.clientWidth;
      if (el.width !== Math.round(size * dpr)) {
        el.width = el.height = Math.round(size * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const c = size / 2;
      const thinkingPulse = target.current.status === "thinking" ? Math.sin(t * 4) * 0.015 : 0;
      const r = size * 0.36 * (1 + level * 0.12 + thinkingPulse);

      // outer glow
      const halo = ctx.createRadialGradient(c, c, r * 0.8, c, c, r * 1.35);
      halo.addColorStop(0, rgba(glow, 0.22 + level * 0.25));
      halo.addColorStop(1, rgba(glow, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, size, size);

      // sphere body
      ctx.save();
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "#f8fbff";
      ctx.fillRect(0, 0, size, size);

      ctx.filter = `blur(${r * 0.28}px)`;
      ctx.globalCompositeOperation = "multiply";
      colors.forEach((col, i) => {
        const a = t * (0.9 + i * 0.35) + i * 2.1;
        const reach = r * (0.38 + level * 0.18);
        const x = c + Math.cos(a) * reach;
        const y = c + Math.sin(a * 1.3 + i) * reach;
        ctx.fillStyle = rgba(col, 0.95);
        ctx.beginPath();
        ctx.arc(x, y, r * (0.62 + level * 0.2), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.filter = "none";
      ctx.globalCompositeOperation = "source-over";

      // glossy highlight and a soft rim for depth
      const gloss = ctx.createRadialGradient(c - r * 0.35, c - r * 0.45, 0, c - r * 0.35, c - r * 0.45, r * 0.9);
      gloss.addColorStop(0, "rgba(255,255,255,0.75)");
      gloss.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gloss;
      ctx.fillRect(0, 0, size, size);
      const rim = ctx.createRadialGradient(c, c, r * 0.75, c, c, r);
      rim.addColorStop(0, "rgba(15,23,42,0)");
      rim.addColorStop(1, "rgba(15,23,42,0.12)");
      ctx.fillStyle = rim;
      ctx.fillRect(0, 0, size, size);
      ctx.restore();

      if (shadow.current) {
        shadow.current.style.setProperty("--s", (0.85 + level * 0.3).toFixed(3));
        shadow.current.style.setProperty("--o", (0.12 + level * 0.12).toFixed(3));
        shadow.current.style.setProperty("--c", glow.map((v) => v | 0).join(" "));
      }

      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <span className={cx("relative block", className)} aria-hidden="true">
      <canvas ref={canvas} className="block size-full" />
      <span
        ref={shadow}
        className="absolute bottom-[4%] left-1/2 h-[7%] w-[46%] rounded-[50%] blur-md"
        style={{
          transform: "translateX(-50%) scaleX(var(--s, 1))",
          background: "rgb(var(--c, 59 130 246) / var(--o, 0.12))",
        }}
      />
    </span>
  );
}
