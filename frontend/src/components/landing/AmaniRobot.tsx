import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useReducedMotion } from "../../lib/hooks";
import type { CallStatus } from "../../lib/useLiveCall";
import { cx } from "../ui";

// Where the eyes rest while Amani looks around on its own: centre, left, centre, right.
const GAZE: [number, number][] = [
  [0, 0],
  [-1, 0],
  [0, 0],
  [1, 0],
  [0, 0],
  [-0.6, -0.5],
];

/** A friendly square robot whose face shows what the agent is doing. */
export default function AmaniRobot({
  status,
  level,
  hue = 199,
  className,
}: {
  status: CallStatus;
  level: number; // 0–1, how loud whoever is talking is
  hue?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [gazeIndex, setGazeIndex] = useState(0);
  const [blink, setBlink] = useState(false);
  const [pointer, setPointer] = useState<[number, number] | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // look around: hold each direction for a moment, like a curious robot
  useEffect(() => {
    if (reduced || status === "speaking" || status === "listening") return;
    const id = window.setInterval(() => setGazeIndex((i) => (i + 1) % GAZE.length), status === "connecting" ? 260 : 1300);
    return () => window.clearInterval(id);
  }, [reduced, status]);

  // blink every few seconds
  useEffect(() => {
    if (reduced) return;
    let t = 0;
    const schedule = () => {
      t = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 140);
        schedule();
      }, 2200 + Math.random() * 2600);
    };
    schedule();
    return () => window.clearTimeout(t);
  }, [reduced]);

  // follow the visitor's pointer while it's over the robot
  const onMove = (e: PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    const y = ((e.clientY - r.top) / r.height) * 2 - 1;
    setPointer([Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))]);
  };

  let [gx, gy] = pointer ?? GAZE[gazeIndex];
  if (status === "listening" || status === "speaking") [gx, gy] = pointer ?? [0, 0];
  if (status === "thinking") [gx, gy] = [0.7, -0.8];

  // eye shape per state
  const eyeH = blink ? 4 : status === "thinking" ? 14 : status === "speaking" ? 20 : status === "listening" ? 38 + level * 8 : 32;
  const eyeW = status === "listening" ? 28 : 26;
  const happy = status === "speaking" && !blink;
  const mouthW = status === "speaking" ? 26 + level * 26 : status === "listening" ? 16 : 22;
  const mouthH = status === "speaking" ? 6 + level * 16 : 6;
  const active = status !== "idle";

  const accent = `hsl(${hue} 95% 62%)`;
  const glow = `0 0 14px hsl(${hue} 95% 60% / 0.9), 0 0 2px white inset`;

  return (
    <div
      ref={box}
      className={cx("relative select-none", className)}
      onPointerMove={onMove}
      onPointerLeave={() => setPointer(null)}
      aria-hidden="true"
      style={{ "--accent": accent } as CSSProperties}
    >
      <div className={cx("relative mx-auto w-fit", !reduced && "animate-float")}>
      {/* tilts towards where it's looking; the float above moves it up and down */}
      <div className="transition-transform duration-500" style={{ transform: `rotate(${gx * 3}deg)` }}>
        {/* antenna */}
        <div className="relative mx-auto h-10 w-1.5 rounded-full bg-slate-300">
          <span
            className={cx("absolute -top-3 left-1/2 size-5 -translate-x-1/2 rounded-full transition-all duration-300", active && !reduced && "animate-pulse")}
            style={{ background: active ? accent : "rgb(203 213 225)", boxShadow: active ? glow : "none" }}
          />
        </div>

        {/* head */}
        <div
          className="relative h-48 w-56 rounded-[2.75rem] p-4 shadow-2xl transition-shadow duration-500"
          style={{
            background: `linear-gradient(160deg, white, hsl(${hue} 60% 92%))`,
            boxShadow: `0 30px 60px -20px hsl(${hue} 60% 40% / 0.35), inset 0 -8px 0 hsl(${hue} 40% 85%), inset 0 2px 0 white`,
          }}
        >
          {/* ear bolts */}
          {[-1, 1].map((side) => (
            <span
              key={side}
              className="absolute top-1/2 h-12 w-3.5 -translate-y-1/2 rounded-full"
              style={{ [side < 0 ? "left" : "right"]: "-0.6rem", background: `hsl(${hue} 30% 80%)` }}
            />
          ))}

          {/* face screen */}
          <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[2rem] bg-slate-900 shadow-inner">
            <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgb(255_255_255/0.12),transparent)]" />

            {/* thinking dots */}
            <div className={cx("absolute right-6 top-4 flex gap-1 transition-opacity", status === "thinking" ? "opacity-100" : "opacity-0")}>
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-1.5 animate-bounce rounded-full" style={{ background: accent, animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>

            {/* eyes */}
            <div
              className="flex gap-9 transition-transform duration-300 ease-out"
              style={{ transform: `translate(${gx * 16}px, ${gy * 9}px)` }}
            >
              {[0, 1].map((i) =>
                happy ? (
                  <span
                    key={i}
                    className="block h-4 w-7 rounded-t-full border-[5px] border-b-0"
                    style={{ borderColor: accent, filter: `drop-shadow(0 0 6px ${accent})` }}
                  />
                ) : (
                  <span
                    key={i}
                    className="block rounded-[0.6rem] transition-all duration-150"
                    style={{ width: eyeW, height: eyeH, background: accent, boxShadow: glow }}
                  />
                ),
              )}
            </div>

            {/* mouth */}
            <span
              className="mt-5 block rounded-full transition-all duration-100"
              style={{
                width: mouthW,
                height: mouthH,
                background: status === "speaking" ? accent : "transparent",
                border: status === "speaking" ? "none" : `3px solid ${accent}`,
                borderTop: status === "speaking" ? "none" : "3px solid transparent",
                borderRadius: status === "speaking" ? "999px" : "0 0 999px 999px",
                opacity: 0.9,
              }}
            />

            {/* cheeks */}
            {[-1, 1].map((side) => (
              <span
                key={side}
                className={cx("absolute bottom-8 h-3 w-6 rounded-full bg-pink-400/40 blur-[2px] transition-opacity duration-500", status === "speaking" ? "opacity-100" : "opacity-50")}
                style={{ [side < 0 ? "left" : "right"]: "1.4rem" }}
              />
            ))}
          </div>
        </div>

        {/* neck */}
        <div className="mx-auto h-3 w-20 rounded-b-xl" style={{ background: `hsl(${hue} 30% 82%)` }} />
      </div>
      </div>
      {/* shadow stays on the ground while the robot floats */}
      <div
          className="mx-auto mt-6 h-4 rounded-[50%] bg-slate-900/10 blur-md transition-all duration-300"
          style={{ width: `${10 + level * 3}rem` }}
        />
    </div>
  );
}
