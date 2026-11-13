import { Check, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { api, errorMessage, type RefineField } from "../lib/api";
import { Button } from "./ui";

/**
 * "Improve with AI" for a free-text field. The suggestion is shown next to the
 * owner's text and only replaces it when they choose "Use this".
 */
export default function AiImprove({
  field,
  value,
  onApply,
  businessName,
  assistantName,
  label = "Improve with AI",
}: {
  field: RefineField;
  value: string;
  onApply: (text: string) => void;
  businessName?: string;
  assistantName?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string>();
  const [error, setError] = useState<string>();
  const tooShort = value.trim().length < 3;

  const improve = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const { text } = await api.refine({
        field,
        text: value,
        business_name: businessName?.trim() || undefined,
        assistant_name: assistantName?.trim() || undefined,
      });
      setSuggestion(text);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (suggestion !== undefined)
    return (
      <div className="mt-2 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-violet-700">
          <Sparkles className="size-3.5" />
          AI suggestion: check it's correct before using it
        </div>
        <p className="whitespace-pre-wrap rounded-lg bg-white p-3 text-sm text-slate-800 ring-1 ring-violet-100">
          {suggestion}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            icon={<Check className="size-4" />}
            onClick={() => {
              onApply(suggestion);
              setSuggestion(undefined);
            }}
          >
            Use this
          </Button>
          <Button type="button" variant="secondary" icon={<X className="size-4" />} onClick={() => setSuggestion(undefined)}>
            Keep mine
          </Button>
          <Button type="button" variant="ghost" loading={loading} icon={<RotateCcw className="size-4" />} onClick={improve}>
            Try again
          </Button>
        </div>
      </div>
    );

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={improve}
        disabled={loading || tooShort}
        title={tooShort ? "Write a few words first" : undefined}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
        {loading ? "Improving… this can take a moment" : label}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
