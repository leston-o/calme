import { CalendarCheck, Check, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api, errorMessage, type DemoRequest } from "../../lib/api";
import { cx } from "../ui";

const TIMES = ["Any time", "Weekday mornings", "Weekday afternoons", "Weekday evenings", "Weekends"];

function Field({ label, optional, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
      </span>
      {children}
    </label>
  );
}

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 transition focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-950/5";

/** A dialog where a business asks for a demo; the backend emails it to the team. */
export default function BookDemo({ open, onClose }: { open: boolean; onClose: () => void }) {
  const empty: DemoRequest = { name: "", email: "", business: "", phone: "", preferred_time: TIMES[0], message: "", website: "" };
  const [form, setForm] = useState<DemoRequest>(empty);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string>();
  const first = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  // while closed, nothing inside can be focused or read out
  useEffect(() => {
    root.current?.toggleAttribute("inert", !open);
  }, [open]);
  const set = <K extends keyof DemoRequest>(k: K, v: DemoRequest[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => first.current?.focus(), 120);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // start fresh next time it opens after a successful send
  useEffect(() => {
    if (!open && state === "sent") {
      setForm(empty);
      setState("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError(undefined);
    try {
      await api.bookDemo({
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        business: form.business.trim(),
        phone: form.phone?.trim() || undefined,
        message: form.message?.trim() || undefined,
      });
      setState("sent");
    } catch (err) {
      setError(errorMessage(err));
      setState("idle");
    }
  };

  return (
    <div
      ref={root}
      className={cx("fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6", open ? "pointer-events-auto" : "pointer-events-none")}
      aria-hidden={!open}
    >
      <div
        className={cx("absolute inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-demo-title"
        className={cx(
          "relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[1.75rem] bg-white p-6 shadow-2xl transition-all duration-500 ease-[cubic-bezier(.2,.7,.2,1)] sm:p-8",
          open ? "translate-y-0 scale-100 opacity-100" : "translate-y-6 scale-95 opacity-0",
        )}
      >
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
          <X className="size-4" />
        </button>

        {state === "sent" ? (
          <div className="swap-in py-6 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
              <Check className="size-7" strokeWidth={3} />
            </span>
            <h2 className="mt-5 font-display text-4xl">You're on the list.</h2>
            <p className="mx-auto mt-2 max-w-sm text-slate-600">
              Thanks, {form.name.split(" ")[0] || "there"}. We'll email you at {form.email} to set up a time.
            </p>
            <button onClick={onClose} className="mt-7 inline-flex h-11 items-center rounded-full bg-slate-950 px-6 text-sm font-medium text-white hover:bg-slate-800">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-slate-950 text-white">
                <CalendarCheck className="size-5" />
              </span>
              <h2 id="book-demo-title" className="mt-4 font-display text-4xl leading-tight">
                Book a demo
              </h2>
              <p className="mt-1 text-slate-600">We'll set up a call agent for your business and walk you through it.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name">
                <input ref={first} required maxLength={100} className={input} value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
              </Field>
              <Field label="Email">
                <input required type="email" maxLength={200} className={input} value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
              </Field>
              <Field label="Business name">
                <input required maxLength={200} className={input} value={form.business} onChange={(e) => set("business", e.target.value)} autoComplete="organization" />
              </Field>
              <Field label="Phone" optional>
                <input type="tel" maxLength={40} className={input} value={form.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" />
              </Field>
            </div>
            <Field label="Best time to talk">
              <div className="flex flex-wrap gap-2">
                {TIMES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("preferred_time", t)}
                    className={cx(
                      "rounded-full px-3 py-1.5 text-sm transition active:scale-95",
                      form.preferred_time === t ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Anything we should know?" optional>
              <textarea
                rows={3}
                maxLength={2000}
                className={cx(input, "resize-none")}
                value={form.message}
                onChange={(e) => set("message", e.target.value)}
                placeholder="What kind of business you run, how many calls you get…"
              />
            </Field>
            {/* honeypot: hidden from people, tempting to bots */}
            <input
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute -left-[9999px] h-0 w-0 opacity-0"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              name="website"
            />

            {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={state === "sending"}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-950 text-[0.9375rem] font-medium text-white transition hover:bg-slate-800 active:scale-[0.99] disabled:opacity-60"
            >
              {state === "sending" && <Loader2 className="size-4 animate-spin" />}
              {state === "sending" ? "Sending…" : "Request my demo"}
            </button>
            <p className="text-center text-xs text-slate-400">We only use your details to arrange the demo.</p>
          </form>
        )}
      </div>
    </div>
  );
}
