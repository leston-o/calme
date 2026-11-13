import { useState, type FormEvent } from "react";
import type { Agent, AgentInput } from "../lib/api";
import AiImprove from "./AiImprove";
import { Button, Field, Input, Textarea } from "./ui";
import VoicePicker from "./VoicePicker";

export const DEFAULT_GREETING = "Hello, thanks for getting in touch. How can I help you today?";

export function toInput(agent?: Agent): AgentInput {
  return {
    name: agent?.name ?? "",
    business_name: agent?.business_name ?? "",
    business_description: agent?.business_description ?? "",
    greeting: agent?.greeting ?? DEFAULT_GREETING,
    voice: agent?.voice ?? "Clara",
  };
}

export default function AgentForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Agent;
  submitLabel: string;
  onSubmit: (data: AgentInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<AgentInput>(() => toInput(initial));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof AgentInput>(k: K, v: AgentInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(toInput(initial));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field
        label="What your assistant knows"
        hint="Opening hours, services, prices, booking rules, directions. Your assistant only answers from this, so keep it up to date."
      >
        <Textarea
          required
          minLength={10}
          maxLength={10_000}
          rows={8}
          value={form.business_description}
          onChange={(e) => set("business_description", e.target.value)}
        />
        <AiImprove
          field="business_description"
          value={form.business_description}
          onApply={(t) => set("business_description", t)}
          businessName={form.business_name}
        />
      </Field>
      <Field label="How it greets customers">
        <Textarea
          rows={2}
          maxLength={500}
          value={form.greeting}
          onChange={(e) => set("greeting", e.target.value)}
        />
        <AiImprove
          field="greeting"
          label="Make it sound friendlier with AI"
          value={form.greeting}
          onApply={(t) => set("greeting", t)}
          businessName={form.business_name}
          assistantName={form.name}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Assistant's name">
          <Input required maxLength={100} value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Business name">
          <Input
            required
            maxLength={200}
            value={form.business_name}
            onChange={(e) => set("business_name", e.target.value)}
          />
        </Field>
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Voice</span>
        <VoicePicker value={form.voice} onChange={(v) => set("voice", v)} />
      </div>
      <div className="sticky bottom-0 -mx-5 -mb-5 flex items-center justify-end gap-3 rounded-b-xl border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
        {dirty && <span className="mr-auto text-sm text-amber-700">You have unsaved changes</span>}
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={saving} disabled={!dirty}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
