import { Check } from "lucide-react";
import { VOICES, type VoiceName } from "../lib/api";
import { cx } from "./ui";

/** Pick one of Live 3's voices. Hear it by trying the assistant live. */
export default function VoicePicker({
  value,
  onChange,
}: {
  value: VoiceName;
  onChange: (voice: VoiceName) => void;
}) {
  return (
    <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {VOICES.map((v) => {
        const selected = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(v)}
            className={cx(
              "flex items-center gap-2.5 rounded-2xl border px-3.5 py-3 text-left text-sm font-medium transition",
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
            {v}
          </button>
        );
      })}
    </div>
  );
}
