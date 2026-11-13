import { Check, Loader2, Mic, Play, Square } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../lib/api";
import { useAdvancedMode, useAudioPlayer, useSavedVoices } from "../lib/hooks";
import { cx, Input } from "./ui";

const SAMPLE = "Hello, thanks for calling. How can I help you today?";

/** Pick a voice by listening to it, not by ID. */
export default function VoicePicker({
  value,
  onChange,
  inWizard,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  /** Leaving the page would lose the wizard's answers, so explain instead of linking. */
  inWizard?: boolean;
}) {
  const { voices } = useSavedVoices();
  const [advanced] = useAdvancedMode();
  const player = useAudioPlayer();
  const [loading, setLoading] = useState<string | null>();
  const [playingId, setPlayingId] = useState<string | null>();
  const [error, setError] = useState<string>();

  const ready = voices.filter((v) => v.state === "trained");
  const options = [{ id: null as string | null, title: "Standard voice", note: "Clear and friendly" }].concat(
    ready.map((v) => ({ id: v.id as string | null, title: v.title, note: "Your custom voice" })),
  );
  const unknownCurrent = value && !ready.some((v) => v.id === value);

  const listen = async (id: string | null) => {
    if (player.playing && playingId === id) return player.stop();
    setLoading(id ?? "standard");
    setError(undefined);
    try {
      player.play(await api.tts(SAMPLE, id ?? undefined));
      setPlayingId(id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(undefined);
    }
  };

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const selected = value === o.id;
          const key = o.id ?? "standard";
          const isPlaying = player.playing && playingId === o.id;
          return (
            <div
              key={key}
              role="radio"
              aria-checked={selected}
              tabIndex={0}
              onClick={() => onChange(o.id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onChange(o.id)}
              className={cx(
                "flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition",
                selected
                  ? "border-slate-950 bg-slate-50 ring-4 ring-slate-950/5"
                  : "border-slate-200 hover:border-slate-300",
              )}
            >
              <span
                className={cx(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border",
                  selected ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300",
                )}
              >
                {selected && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{o.title}</span>
                <span className="block text-xs text-slate-500">{o.note}</span>
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  listen(o.id);
                }}
                className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-brand-700 hover:bg-brand-100/60"
              >
                {loading === key ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : isPlaying ? (
                  <Square className="size-3.5" />
                ) : (
                  <Play className="size-3.5" />
                )}
                {isPlaying ? "Stop" : "Listen"}
              </button>
            </div>
          );
        })}
        {inWizard ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-600">
            <span className="flex size-5 items-center justify-center">
              <Mic className="size-4" />
            </span>
            <span>
              <span className="block font-medium">Want your own voice?</span>
              <span className="block text-xs text-slate-500">You can record it on the Voices page later</span>
            </span>
          </div>
        ) : (
        <Link
          to="/voices"
          className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-600 hover:border-brand-500 hover:text-brand-700"
        >
          <span className="flex size-5 items-center justify-center">
            <Mic className="size-4" />
          </span>
          <span>
            <span className="block font-medium">Use your own voice</span>
            <span className="block text-xs text-slate-500">Record a short sample</span>
          </span>
        </Link>
        )}
      </div>
      {unknownCurrent && !advanced && (
        <p className="mt-2 text-xs text-slate-500">This assistant uses a custom voice set up elsewhere.</p>
      )}
      {advanced && (
        <div className="mt-3">
          <span className="mb-1 block text-xs font-medium text-slate-500">Voice ID (advanced)</span>
          <Input
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value.trim() || null)}
            placeholder="Fish Audio voice/reference ID"
          />
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
