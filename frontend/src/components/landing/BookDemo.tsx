import { ArrowLeft, CalendarCheck, Check, ChevronLeft, ChevronRight, Clock, Globe, Loader2, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiError, errorMessage, type DemoAvailability, type DemoBooking, type DemoSlot } from "../../lib/api";
import { cx } from "../ui";

const visitorZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const longDay = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" });
const monthFmt = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const weekdayShort = Array.from({ length: 7 }, (_, i) =>
  new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(new Date(2024, 0, i + 1)),
); // 1 Jan 2024 was a Monday

const span = (s: DemoSlot) => `${timeFmt.format(new Date(s.start))} – ${timeFmt.format(new Date(s.end))}`;
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseDay = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

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

/** A month view: days with free slots can be picked; the rest are greyed out. */
function MonthGrid({
  days,
  selected,
  onSelect,
}: {
  days: DemoAvailability["days"];
  selected: string | undefined;
  onSelect: (day: string) => void;
}) {
  const byDay = useMemo(() => new Map(days.map((d) => [d.date, d.slots])), [days]);
  const months = useMemo(() => {
    const keys = [...new Set(days.map((d) => d.date.slice(0, 7)))];
    return keys.length ? keys : [isoDay(new Date()).slice(0, 7)];
  }, [days]);
  const [monthIndex, setMonthIndex] = useState(0);
  useEffect(() => {
    if (selected) setMonthIndex(Math.max(0, months.indexOf(selected.slice(0, 7))));
  }, [selected, months]);

  const [y, m] = months[monthIndex].split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const count = new Date(y, m, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => new Date(y, m - 1, i + 1))];

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-900">{monthFmt.format(first)}</span>
        <div className="flex gap-1">
          {[
            [-1, ChevronLeft, "Previous month"],
            [1, ChevronRight, "Next month"],
          ].map(([step, Icon, label]) => {
            const I = Icon as typeof ChevronLeft;
            const next = monthIndex + (step as number);
            return (
              <button
                key={label as string}
                type="button"
                aria-label={label as string}
                disabled={next < 0 || next >= months.length}
                onClick={() => setMonthIndex(next)}
                className="flex size-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <I className="size-4" />
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[0.6875rem] font-medium uppercase text-slate-400">
        {weekdayShort.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div key={months[monthIndex]} className="swap-in mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const key = isoDay(d);
          const slots = byDay.get(key);
          const free = slots?.filter((s) => s.status === "free").length ?? 0;
          const isSel = key === selected;
          return (
            <button
              key={key}
              type="button"
              disabled={!free}
              onClick={() => onSelect(key)}
              aria-pressed={isSel}
              aria-label={`${longDay.format(d)}${free ? `, ${free} free` : ", unavailable"}`}
              className={cx(
                "relative mx-auto flex size-10 items-center justify-center rounded-full text-sm transition-all duration-200",
                isSel
                  ? "scale-105 bg-slate-950 font-semibold text-white shadow-lg"
                  : free
                    ? "bg-sky-50 font-semibold text-sky-700 hover:bg-sky-100 active:scale-95"
                    : "text-slate-300",
              )}
            >
              {d.getDate()}
              {free > 0 && !isSel && <span className="absolute bottom-1 size-1 rounded-full bg-sky-500" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Calendly-style booking: pick a free 2-hour slot, then add your details. */
export default function BookDemo({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [cal, setCal] = useState<DemoAvailability>();
  const [loadError, setLoadError] = useState<string>();
  const [day, setDay] = useState<string>();
  const [slot, setSlot] = useState<DemoSlot>();
  const [step, setStep] = useState<"time" | "details" | "done">("time");
  const [form, setForm] = useState({ name: "", email: "", business: "", phone: "", message: "", website: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const [booked, setBooked] = useState<DemoBooking>();
  const root = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    setLoadError(undefined);
    try {
      const a = await api.demoAvailability();
      setCal(a);
      // open on the first day that still has room
      setDay((d) => (d && a.days.some((x) => x.date === d) ? d : a.days.find((x) => x.slots.some((s) => s.status === "free"))?.date));
    } catch {
      setLoadError("We couldn't load the calendar just now.");
    }
  }, []);

  // fresh availability every time it opens
  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  // while closed, nothing inside can be focused or read out
  useEffect(() => {
    root.current?.toggleAttribute("inert", !open);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (step === "details") window.setTimeout(() => first.current?.focus(), 150);
  }, [step]);

  // start over next time it opens after a booking
  useEffect(() => {
    if (!open && step === "done") {
      setStep("time");
      setSlot(undefined);
      setBooked(undefined);
      setForm({ name: "", email: "", business: "", phone: "", message: "", website: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const slots = cal?.days.find((d) => d.date === day)?.slots ?? [];
  const freeCount = cal?.days.reduce((n, d) => n + d.slots.filter((s) => s.status === "free").length, 0) ?? 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!slot) return;
    setSending(true);
    setError(undefined);
    try {
      const result = await api.bookDemoSlot({
        start: slot.start,
        name: form.name.trim(),
        email: form.email.trim(),
        business: form.business.trim(),
        phone: form.phone.trim() || undefined,
        message: form.message.trim() || undefined,
        website: form.website || undefined,
      });
      setBooked(result);
      setStep("done");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // someone else got there first: show the calendar again, up to date
        setError(err.message);
        setSlot(undefined);
        setStep("time");
        void load();
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      ref={root}
      className={cx("fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6", open ? "pointer-events-auto" : "pointer-events-none")}
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
          "relative max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-[1.75rem] bg-white shadow-2xl transition-all duration-500 ease-[cubic-bezier(.2,.7,.2,1)]",
          open ? "translate-y-0 scale-100 opacity-100" : "translate-y-6 scale-95 opacity-0",
        )}
      >
        <button onClick={onClose} className="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
          <X className="size-4" />
        </button>

        <div className="grid md:grid-cols-[17rem_1fr]">
          {/* what you're booking */}
          <aside className="border-b border-slate-100 bg-slate-50/70 p-6 md:border-b-0 md:border-r sm:p-8">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-slate-950 text-white">
              <CalendarCheck className="size-5" />
            </span>
            <div className="mt-4 text-sm font-medium text-slate-500">CalMe</div>
            <h2 id="book-demo-title" className="mt-1 font-display text-4xl leading-tight">
              Book a demo
            </h2>
            <div className="mt-5 space-y-2.5 text-sm text-slate-600">
              <div className="flex items-center gap-2.5">
                <Clock className="size-4 text-slate-400" />
                {cal ? `${cal.slot_minutes / 60} hours` : "2 hours"}
              </div>
              <div className="flex items-center gap-2.5">
                <Globe className="size-4 text-slate-400" />
                Times in your timezone ({visitorZone.replace(/_/g, " ")})
              </div>
            </div>
            <p className="mt-5 text-sm text-slate-600">
              We'll set up a call agent for your business, let you talk to it, and answer your questions.
            </p>
            {slot && step !== "time" && (
              <div className="swap-in mt-6 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <div className="text-xs font-medium uppercase tracking-wider text-slate-400">Your time</div>
                <div className="mt-1 font-medium text-slate-900">{longDay.format(new Date(slot.start))}</div>
                <div className="text-sm text-slate-600">{span(slot)}</div>
              </div>
            )}
          </aside>

          <div className="min-h-[28rem] p-6 sm:p-8">
            {step === "time" && (
              <div className="swap-in">
                <h3 className="text-lg font-semibold tracking-tight">Pick a day and time</h3>
                {error && <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">{error}</p>}

                {loadError ? (
                  <div className="mt-10 text-center">
                    <p className="text-slate-600">{loadError}</p>
                    <button onClick={load} className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white">
                      <RotateCcw className="size-4" />
                      Try again
                    </button>
                  </div>
                ) : !cal ? (
                  <div className="mt-6 grid grid-cols-7 gap-1">
                    {Array.from({ length: 35 }, (_, i) => (
                      <span key={i} className="mx-auto size-10 animate-pulse rounded-full bg-slate-100" style={{ animationDelay: `${(i % 7) * 60}ms` }} />
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_15rem]">
                    <MonthGrid
                      days={cal.days}
                      selected={day}
                      onSelect={(d) => {
                        setDay(d);
                        setSlot(undefined);
                        setError(undefined);
                      }}
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-900">{day ? longDay.format(parseDay(day)) : "Choose a day"}</div>
                      <div key={day} className="mt-3 space-y-2">
                        {slots.map((s, i) => {
                          const chosen = slot?.start === s.start;
                          if (s.status !== "free")
                            return (
                              <div
                                key={s.start}
                                className="bubble-in flex h-12 items-center justify-between rounded-xl border border-dashed border-slate-200 px-3.5 text-sm text-slate-400"
                                style={{ animationDelay: `${i * 50}ms` }}
                              >
                                <span className="line-through">{span(s)}</span>
                                <span className="text-xs font-medium">{s.status === "booked" ? "Booked" : "Passed"}</span>
                              </div>
                            );
                          return (
                            <div key={s.start} className="bubble-in flex gap-2" style={{ animationDelay: `${i * 50}ms` }}>
                              <button
                                type="button"
                                onClick={() => setSlot(s)}
                                className={cx(
                                  "h-12 rounded-xl border text-sm font-semibold transition-all duration-300",
                                  chosen
                                    ? "w-1/2 border-slate-700 bg-slate-700 text-white"
                                    : "w-full border-sky-200 text-sky-700 hover:border-sky-500 hover:bg-sky-50",
                                )}
                              >
                                {chosen ? timeFmt.format(new Date(s.start)) : span(s)}
                              </button>
                              {chosen && (
                                <button
                                  type="button"
                                  onClick={() => setStep("details")}
                                  className="swap-in h-12 w-1/2 rounded-xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-95"
                                >
                                  Next
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {day && slots.length === 0 && <p className="text-sm text-slate-500">No times on this day.</p>}
                        {!day && freeCount === 0 && (
                          <p className="text-sm text-slate-500">Every slot is taken for now. Please check back soon.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === "details" && slot && (
              <form onSubmit={submit} className="swap-in space-y-4">
                <button
                  type="button"
                  onClick={() => setStep("time")}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
                >
                  <ArrowLeft className="size-4" />
                  Change time
                </button>
                <h3 className="text-lg font-semibold tracking-tight">Your details</h3>
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
                  disabled={sending}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-950 text-[0.9375rem] font-medium text-white transition hover:bg-slate-800 active:scale-[0.99] disabled:opacity-60"
                >
                  {sending && <Loader2 className="size-4 animate-spin" />}
                  {sending ? "Booking…" : "Book my demo"}
                </button>
                <p className="text-center text-xs text-slate-400">We'll email you a calendar invite. We only use your details to arrange the demo.</p>
              </form>
            )}

            {step === "done" && booked && (
              <div className="swap-in flex h-full flex-col items-center justify-center py-10 text-center">
                <span className="flex size-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                  <Check className="size-8" strokeWidth={3} />
                </span>
                <h3 className="mt-5 font-display text-4xl">You're booked.</h3>
                <p className="mt-2 text-lg text-slate-800">
                  {longDay.format(new Date(booked.start))}, {timeFmt.format(new Date(booked.start))} – {timeFmt.format(new Date(booked.end))}
                </p>
                <p className="mx-auto mt-2 max-w-sm text-slate-600">
                  A calendar invite is on its way to {form.email}. Need to change it? Just reply to that email.
                </p>
                <button onClick={onClose} className="mt-7 inline-flex h-11 items-center rounded-full bg-slate-950 px-6 text-sm font-medium text-white hover:bg-slate-800">
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
