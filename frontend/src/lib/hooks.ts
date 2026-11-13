import { useCallback, useEffect, useRef, useState } from "react";

/** Load data on mount (and whenever deps change), with a manual reload. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setData(await fnRef.current());
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void reload(), deps);

  return { data, setData, error, loading, reload };
}

/** Play a blob of audio, stopping whatever this hook played before. */
export function useAudioPlayer() {
  const current = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const stop = useCallback(() => {
    if (current.current) {
      current.current.pause();
      URL.revokeObjectURL(current.current.src);
      current.current = null;
    }
    setPlaying(false);
  }, []);

  const play = useCallback(
    (blob: Blob) => {
      stop();
      const audio = new Audio(URL.createObjectURL(blob));
      current.current = audio;
      audio.onended = stop;
      setPlaying(true);
      audio.play().catch(stop);
    },
    [stop],
  );

  useEffect(() => stop, [stop]);
  return { play, stop, playing };
}

// Developer-facing tools (IDs, webhooks, raw TTS/STT, provider details) stay
// hidden unless the owner switches on advanced mode.
const ADVANCED_KEY = "calme.advanced";
const ADVANCED_EVENT = "calme:advanced";

export function useAdvancedMode(): [boolean, (on: boolean) => void] {
  const read = () => {
    try {
      return localStorage.getItem(ADVANCED_KEY) === "1";
    } catch {
      return false;
    }
  };
  const [on, setOn] = useState(read);

  useEffect(() => {
    const sync = () => setOn(read());
    window.addEventListener(ADVANCED_EVENT, sync);
    return () => window.removeEventListener(ADVANCED_EVENT, sync);
  }, []);

  const set = (next: boolean) => {
    try {
      localStorage.setItem(ADVANCED_KEY, next ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
    setOn(next);
    window.dispatchEvent(new Event(ADVANCED_EVENT));
  };
  return [on, set];
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}
