import { ArrowLeft, ArrowRight, Check, Pencil, Sparkles } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import AiImprove from "../components/AiImprove";
import VoicePicker from "../components/VoicePicker";
import { Alert, Button, Eyebrow, Field, Input, Textarea, cx } from "../components/ui";
import { api, errorMessage, type VoiceName } from "../lib/api";
import {
  BUSINESS_TYPES,
  buildKnowledge,
  suggestGreeting,
  type BusinessType,
} from "../lib/businessTypes";

const STEPS = ["Your business", "What customers ask", "Your assistant", "Review"];

export default function NewAssistant() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<BusinessType>();
  const [business, setBusiness] = useState("");
  const [location, setLocation] = useState("");
  const [hours, setHours] = useState("");
  const [services, setServices] = useState("");
  const [other, setOther] = useState("");
  const [name, setName] = useState("Sam");
  const [greeting, setGreeting] = useState<string>();
  const [voice, setVoice] = useState<VoiceName>("Clara");
  // An AI-polished version of the whole description, accepted on the review step.
  const [polished, setPolished] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const shownGreeting = greeting ?? suggestGreeting(business, name);
  const t = type ?? BUSINESS_TYPES[BUSINESS_TYPES.length - 1];
  const knowledge = polished ?? buildKnowledge({ business, type: t, location, hours, services, other });

  const canNext = [
    !!type && business.trim().length > 0,
    hours.trim().length > 0 || services.trim().length > 0,
    name.trim().length > 0 && shownGreeting.trim().length > 0,
    true,
  ][step];

  const next = (e: FormEvent) => {
    e.preventDefault();
    if (!canNext) return;
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0 });
    } else create();
  };

  const create = async () => {
    setSaving(true);
    setError(undefined);
    try {
      const agent = await api.createAgent({
        name: name.trim(),
        business_name: business.trim(),
        business_description: knowledge,
        greeting: shownGreeting.trim(),
        voice,
      });
      navigate(`/agents/${agent.id}?welcome=1`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/agents"
        className="mb-6 flex w-fit items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="size-4" />
        Cancel
      </Link>

      <Eyebrow>New assistant</Eyebrow>
      <h1 className="mt-3 font-display text-5xl leading-[1.02] tracking-tight">
        Let's meet your <em className="text-slate-400">new assistant.</em>
      </h1>
      <p className="mt-3 text-[0.9375rem] text-slate-500">
        Answer a few questions and your assistant will be ready to talk to customers. Takes about
        3 minutes.
      </p>

      <ol className="mt-6 flex gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1">
            <div className={cx("h-1.5 rounded-full", i < step ? "bg-brand-500" : i === step ? "bg-slate-950" : "bg-slate-200")} />
            <div
              className={cx(
                "mt-2 hidden text-xs font-medium sm:block",
                i === step ? "text-slate-900" : "text-slate-400",
              )}
            >
              {i + 1}. {label}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs font-medium text-slate-500 sm:hidden">
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </p>

      <form
        onSubmit={next}
        className="mt-8 rounded-[1.75rem] border border-slate-200/80 bg-white p-6 sm:p-10"
      >
        {step === 0 && (
          <div className="space-y-6">
            <Question title="What kind of business do you have?">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {BUSINESS_TYPES.map((bt) => (
                  <button
                    type="button"
                    key={bt.id}
                    onClick={() => setType(bt)}
                    className={cx(
                      "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left text-sm font-medium transition",
                      type?.id === bt.id
                        ? "border-slate-950 bg-slate-50 ring-4 ring-slate-950/5"
                        : "border-slate-200 hover:border-slate-300",
                    )}
                  >
                    <span className="text-2xl leading-none">{bt.emoji}</span>
                    {bt.label}
                  </button>
                ))}
              </div>
            </Question>
            <Field label="Business name">
              <Input
                required
                maxLength={200}
                value={business}
                onChange={(e) => setBusiness(e.target.value)}
                placeholder="e.g. Sunrise Dental"
              />
            </Field>
            <Field label="Where are you? (optional)" hint="Town, neighbourhood or street, so customers know where to find you.">
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Westlands, Nairobi" />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <p className="text-sm text-slate-600">
              Your assistant answers customers using only what you write here. Write it the way you'd
              tell a new employee. You can change it any time.
            </p>
            <Field label="When are you open?">
              <Textarea rows={2} value={hours} onChange={(e) => setHours(e.target.value)} placeholder={`e.g. ${t.hours}`} />
              <AiImprove field="hours" value={hours} onApply={setHours} businessName={business} />
            </Field>
            <Field label="What do you offer, and what does it cost?">
              <Textarea
                rows={4}
                value={services}
                onChange={(e) => setServices(e.target.value)}
                placeholder={`e.g. ${t.services}`}
              />
              <AiImprove field="services" value={services} onApply={setServices} businessName={business} />
            </Field>
            <Field label="Anything else customers often ask? (optional)" hint="Bookings, payment, parking, delivery, cancellations…">
              <Textarea rows={3} value={other} onChange={(e) => setOther(e.target.value)} placeholder={`e.g. ${t.other}`} />
              <AiImprove field="other" value={other} onApply={setOther} businessName={business} />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <Field label="Assistant's name" hint="What it calls itself when talking to customers.">
              <Input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field
              label="How it greets customers"
              hint={
                greeting !== undefined ? (
                  <button type="button" className="text-brand-700 hover:underline" onClick={() => setGreeting(undefined)}>
                    Use the suggested greeting
                  </button>
                ) : (
                  "We wrote this for you. Change it if you like."
                )
              }
            >
              <Textarea rows={2} maxLength={500} value={shownGreeting} onChange={(e) => setGreeting(e.target.value)} />
              <AiImprove
                field="greeting"
                label="Make it sound friendlier with AI"
                value={shownGreeting}
                onApply={setGreeting}
                businessName={business}
                assistantName={name}
              />
            </Field>
            <Question title="Choose a voice" hint="You'll hear it when you try your assistant. You can change it any time.">
              <VoicePicker value={voice} onChange={setVoice} />
            </Question>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <ReviewRow label="Business" onEdit={() => setStep(0)}>
              {business} · {t.label}
              {location && ` · ${location}`}
            </ReviewRow>
            <ReviewRow label="Assistant" onEdit={() => setStep(2)}>
              {name} · {voice}
            </ReviewRow>
            <ReviewRow label="Greets customers with" onEdit={() => setStep(2)}>
              “{shownGreeting}”
            </ReviewRow>
            <ReviewRow
              label="What it knows"
              onEdit={() => {
                setPolished(undefined);
                setStep(1);
              }}
            >
              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700">{knowledge}</pre>
              {polished === undefined ? (
                <AiImprove
                  field="business_description"
                  label="Tidy this up with AI"
                  value={knowledge}
                  onApply={setPolished}
                  businessName={business}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setPolished(undefined)}
                  className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  Undo AI changes
                </button>
              )}
            </ReviewRow>
            {error && <Alert onClose={() => setError(undefined)}>{error}</Alert>}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-100 pt-6">
          {step > 0 ? (
            <Button type="button" variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="submit"
            className="h-10 px-5"
            disabled={!canNext}
            loading={saving}
            icon={step === STEPS.length - 1 ? <Sparkles className="size-4" /> : undefined}
          >
            {step === STEPS.length - 1 ? "Create my assistant" : "Continue"}
            {step < STEPS.length - 1 && <ArrowRight className="size-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Question({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-3">
        <div className="text-sm font-medium text-slate-700">{title}</div>
        {hint && <div className="text-xs text-slate-500">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function ReviewRow({ label, onEdit, children }: { label: string; onEdit: () => void; children: ReactNode }) {
  return (
    <div className="flex gap-4 rounded-xl bg-slate-50/80 p-4">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          <Check className="size-3.5 text-emerald-600" />
          {label}
        </div>
        <div className="text-sm text-slate-800">{children}</div>
      </div>
      <button type="button" onClick={onEdit} className="self-start text-slate-400 hover:text-brand-700" aria-label={`Edit ${label}`}>
        <Pencil className="size-4" />
      </button>
    </div>
  );
}
