import { Check, Loader2, Mic, RotateCcw, ShieldCheck, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { useVoiceRecorder } from "../../lib/useVoiceRecorder";
import { cx } from "../ui";

const MIN_SECONDS = 10;
const MAX_SECONDS = 30;
// Shown until the backend's copy loads; keep in step with app/services/demo_voices.py.
const FALLBACK_PASSAGE =
  "Hello, and thanks for calling. I'm happy to help with opening hours, prices or bookings. " +
  "If I can't answer straight away, I'll take a message and make sure someone gets back to you today.";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Record a short sample, agree to a temporary copy, and get a voice for the demo. */
export default function VoiceClone({ onReady }: { onReady: (ref: string, expiresAt: string) => void }) {
  const rec = useVoiceRecorder(MAX_SECONDS);
  const [passage, setPassage] = useState(FALLBACK_PASSAGE);
  const [minutes, setMinutes] = useState(30);
  const [consent, setConsent] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();
  const clipUrl = useMemo(() => (rec.clip ? URL.createObjectURL(rec.clip) : undefined), [rec.clip]);

  useEffect(
    () => () => {
      if (clipUrl) URL.revokeObjectURL(clipUrl);
    },
    [clipUrl],
  );
  useEffect(() => {
    api
      .demoClonePassage()
      .then((p) => {
        setPassage(p.passage);
        setMinutes(p.minutes);
      })
      .catch(() => {});
  }, []);

  const longEnough = rec.seconds >= MIN_SECONDS;

  const create = async () => {
    if (!rec.clip || !consent) return;
    setCreating(true);
    setError(undefined);
    try {
      const v = await api.demoCloneVoice(rec.clip, consent);
      onReady(v.voice_ref, v.expires_at);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  if (creating)
    return (
      <div className="swap-in mt-5 flex flex-col items-center gap-3 py-8 text-center">
        <Loader2 className="size-7 animate-spin text-violet-500" />
        <div className="font-medium">Building your voice…</div>
        <p className="text-sm text-slate-500">This usually takes a few seconds.</p>
      </div>
    );

  return (
    <div className="swap-in mt-5 space-y-4">
      <div className="rounded-2xl bg-violet-50/70 p-4 ring-1 ring-violet-100">
        <div className="text-xs font-medium uppercase tracking-wider text-violet-500">Read this aloud</div>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-slate-800">“{passage}”</p>
      </div>

      {/* recorder */}
      {rec.processing ? (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Preparing your recording…
        </div>
      ) : !rec.clip ? (
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={rec.recording ? rec.stop : rec.start}
            disabled={rec.recording && !longEnough}
            className={cx(
              "relative flex size-16 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95",
              rec.recording ? "bg-red-600 shadow-red-600/30" : "bg-slate-950 shadow-slate-900/20 hover:bg-slate-800",
              rec.recording && !longEnough && "cursor-not-allowed",
            )}
            aria-label={rec.recording ? "Stop recording" : "Start recording"}
          >
            {rec.recording && (
              <span
                className="absolute inset-0 rounded-full bg-red-500/40 transition-transform duration-100"
                style={{ transform: `scale(${1 + rec.level * 0.5})` }}
              />
            )}
            {rec.recording ? <Square className="relative size-5 fill-current" /> : <Mic className="relative size-6" />}
          </button>
          <div className="text-center text-sm">
            {rec.recording ? (
              <span className="tabular font-medium text-slate-800">
                {clock(rec.seconds)} <span className="text-slate-400">/ {clock(MAX_SECONDS)}</span>
                <span className="mt-0.5 block text-xs font-normal text-slate-500">
                  {longEnough ? "Tap to stop when you've finished" : `Keep reading, at least ${MIN_SECONDS} seconds`}
                </span>
              </span>
            ) : (
              <span className="text-slate-500">Tap to record, then read the passage in your normal voice</span>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <audio src={clipUrl} controls className="h-10 min-w-0 flex-1" />
            <button
              type="button"
              onClick={rec.reset}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
            >
              <RotateCcw className="size-3.5" />
              Redo
            </button>
          </div>
          {!longEnough && <p className="text-sm text-amber-700">That's a bit short. Please record at least {MIN_SECONDS} seconds.</p>}
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-600">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-slate-950" />
            <span>This is my own voice, and I agree to CalMe making a temporary AI copy of it for this demo.</span>
          </label>
          <button
            type="button"
            onClick={create}
            disabled={!consent || !longEnough}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-violet-600 text-[0.9375rem] font-medium text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700 active:scale-[0.99] disabled:opacity-50"
          >
            <Check className="size-4" />
            Create my voice
          </button>
        </div>
      )}

      {(rec.error || error) && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{rec.error || error}</p>}

      <p className="flex items-start gap-2 text-xs text-slate-400">
        <ShieldCheck className="mt-px size-3.5 shrink-0" />
        Your voice is used only for this demo, processed by our voice provider, and deleted after {minutes} minutes, or sooner if you ask.
      </p>
    </div>
  );
}
