import { useCallback, useEffect, useRef } from "react";

// A phone ringing, made with the Web Audio API so there's no sound file to load:
// two soft rings (two mixed tones), then a pause, repeated.
const TONES = [400, 450]; // Hz
const RINGS: [number, number][] = [
  [0, 0.4],
  [0.6, 1.0],
]; // [start, end] seconds within each cycle
const CYCLE = 3; // seconds
const VOLUME = 0.07;
const FADE = 0.02; // seconds, avoids clicks at the edges of each ring

/**
 * Plays a ringback tone while `ringing` is true.
 * Call `prime()` from the click that starts the call: browsers only allow sound
 * after the visitor has interacted with the page.
 */
export function useRingback(ringing: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);

  const prime = useCallback(() => {
    try {
      ctxRef.current ??= new AudioContext();
      void ctxRef.current.resume();
    } catch {
      /* no Web Audio: the call still works, just silently */
    }
  }, []);

  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ringing || !ctx) return;

    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(ctx.destination);
    const oscillators = TONES.map((hz) => {
      const osc = ctx.createOscillator();
      osc.frequency.value = hz;
      osc.connect(out);
      osc.start();
      return osc;
    });

    // schedule rings a little ahead of time so they stay in rhythm
    let next = ctx.currentTime + 0.05;
    const schedule = () => {
      while (next < ctx.currentTime + CYCLE) {
        for (const [from, to] of RINGS) {
          out.gain.setValueAtTime(0, next + from);
          out.gain.linearRampToValueAtTime(VOLUME, next + from + FADE);
          out.gain.setValueAtTime(VOLUME, next + to - FADE);
          out.gain.linearRampToValueAtTime(0, next + to);
        }
        next += CYCLE;
      }
    };
    schedule();
    const timer = window.setInterval(schedule, 1000);

    return () => {
      window.clearInterval(timer);
      const now = ctx.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(0, now + FADE);
      oscillators.forEach((osc) => osc.stop(now + FADE + 0.01));
      window.setTimeout(() => out.disconnect(), 100);
    };
  }, [ringing]);

  // release the audio device when the component goes away
  useEffect(
    () => () => {
      void ctxRef.current?.close();
      ctxRef.current = null;
    },
    [],
  );

  return { prime };
}
