import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  CalendarCheck,
  Check,
  Mail,
  MessageCircle,
  Mic,
  Moon,
  Phone,
  PhoneForwarded,
  Plus,
  ShieldCheck,
  Sparkles,
  Sun,
  Sunrise,
  Utensils,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cx } from "../components/ui";
import Waveform from "../components/Waveform";
import { useReducedMotion } from "../lib/hooks";

const SETUP = "/agents/new";
const SIGN_IN = "/dashboard";

// ---------- shared bits ----------

function Logo({ dark }: { dark?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span
        className={cx(
          "flex size-8 items-center justify-center rounded-full",
          dark ? "bg-white text-slate-950" : "bg-slate-950 text-white",
        )}
      >
        <AudioLines className="size-4" />
      </span>
      <span className={cx("font-display text-2xl leading-none", dark ? "text-white" : "text-slate-950")}>CalMe</span>
    </Link>
  );
}

function PrimaryCta({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Link
      to={SETUP}
      className={cx(
        "group inline-flex h-12 items-center gap-2 rounded-full bg-slate-950 pl-6 pr-2 text-[0.9375rem] font-medium text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800",
        className,
      )}
    >
      {children}
      <span className="flex size-8 items-center justify-center rounded-full bg-brand-500 transition group-hover:translate-x-0.5">
        <ArrowRight className="size-4" />
      </span>
    </Link>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      <span className="h-px w-6 bg-slate-300" />
      {children}
    </div>
  );
}

// ---------- nav ----------

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const root = document.getElementById("landing-scroll");
    const on = () => setScrolled((root?.scrollTop ?? 0) > 8);
    root?.addEventListener("scroll", on);
    return () => root?.removeEventListener("scroll", on);
  }, []);
  return (
    <header
      className={cx(
        "sticky top-0 z-40 transition-colors",
        scrolled ? "border-b border-slate-200/70 bg-white/80 backdrop-blur-md" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-10 px-5 sm:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-slate-600 lg:flex">
          <a href="#day" className="hover:text-slate-950">A day with CalMe</a>
          <a href="#cost" className="hover:text-slate-950">Missed calls</a>
          <a href="#features" className="hover:text-slate-950">Features</a>
          <a href="#faq" className="hover:text-slate-950">Questions</a>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link to={SIGN_IN} className="hidden text-sm font-medium text-slate-600 hover:text-slate-950 sm:block">
            Sign in
          </Link>
          <Link
            to={SETUP}
            className="inline-flex h-9 items-center rounded-full bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

// ---------- hero: a call that plays itself ----------

const CALL: { who: "ai" | "caller"; text: string }[] = [
  { who: "ai", text: "Good evening, Sunrise Dental. This is Sam, how can I help?" },
  { who: "caller", text: "Hi! Are you open this Saturday?" },
  { who: "ai", text: "We are, from 8am to 6pm. Is this for a check-up?" },
  { who: "caller", text: "Yes. How much is that?" },
  { who: "ai", text: "A check-up is 2,000 shillings. Shall I take your name and number so the team can book you in?" },
  { who: "caller", text: "Please. It's Grace, 0712 345 678." },
  { who: "ai", text: "Thanks, Grace. The team will call you first thing tomorrow." },
];

function LiveCall() {
  const reduced = useReducedMotion();
  const [pos, setPos] = useState({ line: 0, chars: 0 });
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (reduced) {
      setPos({ line: CALL.length - 1, chars: Infinity });
      return;
    }
    const cur = CALL[pos.line];
    const t =
      pos.chars < cur.text.length
        ? window.setTimeout(() => setPos({ line: pos.line, chars: pos.chars + 2 }), 32)
        : pos.line < CALL.length - 1
          ? window.setTimeout(() => setPos({ line: pos.line + 1, chars: 0 }), 750)
          : window.setTimeout(() => {
              setPos({ line: 0, chars: 0 });
              setSeconds(0);
            }, 4500);
    return () => window.clearTimeout(t);
  }, [pos, reduced]);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [reduced]);

  const speaking = pos.chars < CALL[pos.line].text.length;
  const who = CALL[pos.line].who;
  const visible = CALL.slice(0, pos.line + 1);
  const time = reduced ? "01:12" : `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="relative mx-auto max-w-5xl">
      {/* floating context chips */}
      <div className="motion-safe-only absolute -top-5 left-1/2 z-10 hidden -translate-x-1/2 animate-float items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-medium shadow-lg shadow-slate-900/5 lg:flex">
        <Moon className="size-3.5 text-violet-500" />
        9:42pm · after closing
      </div>
      <div
        className="motion-safe-only absolute -bottom-5 right-12 z-10 hidden animate-float items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-medium shadow-lg shadow-slate-900/5 lg:flex"
        style={{ animationDelay: "-3s" }}
      >
        <Check className="size-3.5 text-emerald-500" />
        Message saved for the team
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10">
        <div className="grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {/* caller side */}
          <div className="relative flex flex-col justify-between gap-8 border-b border-slate-100 bg-slate-50/70 p-6 md:border-b-0 md:border-r sm:p-8">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/15">
                <span className="relative flex size-2">
                  <span className="motion-safe-only absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                Live call
              </span>
              <span className="tabular font-mono text-sm text-slate-500">{time}</span>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-slate-400">Answering for</div>
              <div className="mt-1 font-display text-3xl leading-tight text-slate-950">Sunrise Dental</div>
              <div className="mt-1 text-sm text-slate-500">Sam · AI receptionist · English</div>
            </div>
            <div>
              <Waveform active={speaking} tone={who === "ai" ? "brand" : "slate"} />
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className={cx("size-1.5 rounded-full", who === "ai" ? "bg-brand-500" : "bg-slate-400")} />
                  {speaking ? (who === "ai" ? "Sam is speaking" : "Caller is speaking") : "Listening…"}
                </span>
                <span>Example call</span>
              </div>
            </div>
          </div>

          {/* transcript */}
          <div className="flex h-[22rem] flex-col justify-end gap-2.5 overflow-hidden p-6 sm:h-[26rem] sm:p-8">
            {visible.map((l, i) => {
              const last = i === pos.line;
              const text = last ? l.text.slice(0, pos.chars) : l.text;
              return (
                <div key={i} className={cx("flex", l.who === "caller" && "justify-end")}>
                  <div
                    className={cx(
                      "max-w-[85%] rounded-2xl px-4 py-2.5 text-[0.9375rem] leading-snug",
                      l.who === "caller"
                        ? "rounded-br-md bg-slate-950 text-white"
                        : "rounded-bl-md bg-brand-50 text-slate-800 ring-1 ring-brand-100",
                    )}
                  >
                    {text}
                    {last && speaking && <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-current" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* soft grid + glow */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(226 232 240 / 0.7) 1px, transparent 1px), linear-gradient(to bottom, rgb(226 232 240 / 0.7) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 70% 55% at 50% 30%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 55% at 50% 30%, black, transparent)",
        }}
      />
      <div className="absolute left-1/2 top-24 -z-10 h-80 w-[44rem] -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl" />

      <div className="mx-auto max-w-7xl px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
        <div className="mx-auto max-w-4xl text-center">
          <Link
            to={SETUP}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 py-1 pl-1 pr-3 text-xs font-medium text-slate-600 shadow-xs backdrop-blur hover:border-slate-300"
          >
            <span className="rounded-full bg-slate-950 px-2 py-0.5 text-white">New</span>
            An AI receptionist for local businesses
            <ArrowUpRight className="size-3.5" />
          </Link>
          <h1 className="mt-7 font-display text-[3.25rem] leading-[0.95] tracking-tight text-slate-950 sm:text-7xl lg:text-[6.5rem]">
            The phone rings.
            <br />
            <em className="bg-gradient-to-r from-brand-600 via-violet-500 to-brand-500 bg-clip-text text-transparent">
              You stay calm.
            </em>
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-slate-600">
            CalMe answers your business phone in a warm, natural voice. It answers your customers'
            questions and takes their messages, day or night, while you get on with your work.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <PrimaryCta>Set up your assistant</PrimaryCta>
            <a href="#day" className="inline-flex h-12 items-center gap-2 px-4 text-[0.9375rem] font-medium text-slate-700 hover:text-slate-950">
              <span className="flex size-8 items-center justify-center rounded-full border border-slate-200 bg-white">
                <Phone className="size-3.5" />
              </span>
              See a day of calls
            </a>
          </div>
          <p className="mt-5 text-sm text-slate-500">Ready in about 3 minutes · No technical skills · Try it yourself before going live</p>
        </div>

        <div className="mt-16 sm:mt-20">
          <LiveCall />
        </div>
      </div>
    </section>
  );
}

function Marquee() {
  const reduced = useReducedMotion();
  const items = [
    "Dental clinics", "Hair salons", "Restaurants", "Auto repair", "Bakeries", "Plumbers",
    "Vet clinics", "Gyms", "Florists", "Spas", "Pharmacies", "Cafés", "Barbers", "Driving schools",
  ];
  const row = (
    <div className="flex shrink-0 items-center gap-10 pr-10">
      {items.map((t) => (
        <span key={t} className="flex items-center gap-10 whitespace-nowrap font-display text-2xl text-slate-400">
          {t}
          <span className="size-1.5 rounded-full bg-slate-300" />
        </span>
      ))}
    </div>
  );
  return (
    <div className="border-y border-slate-100 py-6">
      <div className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        Made for the businesses on your street
      </div>
      <div className="flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <div className={cx("flex", !reduced && "motion-safe-only animate-marquee")}>
          {row}
          {row}
        </div>
      </div>
    </div>
  );
}

// ---------- a day with CalMe ----------

const DAY: { hour: number; time: string; tag: string; icon: typeof Sun; caller: string; reply: string }[] = [
  {
    hour: 6.2,
    time: "6:12am",
    tag: "Before opening",
    icon: Sunrise,
    caller: "My tooth is really hurting, can I come in today?",
    reply: "I'm sorry to hear that. We open at 8. Can I take your name and number so the team calls you as soon as they arrive?",
  },
  {
    hour: 9.1,
    time: "9:05am",
    tag: "Busy morning",
    icon: Sun,
    caller: "Where exactly are you? I can't find the entrance.",
    reply: "We're on the first floor above the pharmacy on Mpaka Road. The entrance is on the left side of the building.",
  },
  {
    hour: 12.7,
    time: "12:40pm",
    tag: "Lunch rush",
    icon: Utensils,
    caller: "Do you accept insurance?",
    reply: "Yes, we accept most major insurance. Please bring your card to your appointment.",
  },
  {
    hour: 17.9,
    time: "5:55pm",
    tag: "Closing time",
    icon: Sun,
    caller: "Can I get my teeth whitened for half price?",
    reply: "I'm not able to agree to a discount, but I can take a message and the owner will get back to you.",
  },
  {
    hour: 21.7,
    time: "9:42pm",
    tag: "After hours",
    icon: Moon,
    caller: "Are you open this Saturday?",
    reply: "We are, from 8am to 6pm. Shall I take your details so the team can book you in?",
  },
];

function DayTimeline() {
  const [sel, setSel] = useState(4);
  const e = DAY[sel];
  const pct = (h: number) => `${(h / 24) * 100}%`;
  return (
    <section id="day" className="scroll-mt-16 py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
          <div>
            <Eyebrow>A day with CalMe</Eyebrow>
            <h2 className="mt-4 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">
              Twenty-four hours.
              <br />
              <em className="text-slate-400">Not one missed call.</em>
            </h2>
          </div>
          <p className="max-w-md text-lg text-slate-600 lg:justify-self-end">
            Early mornings, the lunch rush and long after you've locked up, your assistant answers
            every call the same calm way. Tap a call to see how it went.
          </p>
        </div>

        <div className="mt-14 rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-xs sm:p-10">
          {/* the 24h ribbon */}
          <div className="relative pb-10 pt-8">
            <div className="relative h-3 rounded-full bg-slate-100">
              <div
                className="absolute inset-y-0 rounded-full bg-brand-100"
                style={{ left: pct(8), width: pct(10) }}
                title="Opening hours"
              />
            </div>
            <div className="absolute top-1 text-[0.6875rem] font-medium uppercase tracking-wider text-brand-600" style={{ left: pct(8) }}>
              Open 8am–6pm
            </div>
            {DAY.map((d, i) => (
              <button
                key={d.time}
                onClick={() => setSel(i)}
                className="group absolute top-[2.375rem] -translate-x-1/2 -translate-y-1/2 p-2"
                style={{ left: pct(d.hour) }}
                aria-label={`${d.time} call`}
                aria-pressed={sel === i}
              >
                <span
                  className={cx(
                    "block rounded-full border-2 border-white shadow transition",
                    sel === i ? "size-5 bg-slate-950 ring-4 ring-slate-950/10" : "size-3.5 bg-brand-500 group-hover:scale-125",
                  )}
                />
              </button>
            ))}
            <div className="absolute inset-x-0 bottom-0 flex justify-between text-xs text-slate-400">
              {["12am", "6am", "12pm", "6pm", "12am"].map((l, i) => (
                <span key={i}>{l}</span>
              ))}
            </div>
          </div>

          {/* chips for small screens, where dots are fiddly */}
          <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
            {DAY.map((d, i) => (
              <button
                key={d.time}
                onClick={() => setSel(i)}
                className={cx(
                  "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium",
                  sel === i ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600",
                )}
              >
                {d.time}
              </button>
            ))}
          </div>

          <div key={sel} className="mt-6 grid gap-6 border-t border-slate-100 pt-8 lg:grid-cols-[14rem_1fr]">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <e.icon className="size-4" />
                {e.tag}
              </div>
              <div className="tabular mt-1 font-display text-5xl">{e.time}</div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-end">
                <p className="max-w-lg rounded-2xl rounded-br-md bg-slate-950 px-4 py-3 text-white">{e.caller}</p>
              </div>
              <div className="flex">
                <p className="max-w-lg rounded-2xl rounded-bl-md bg-brand-50 px-4 py-3 text-slate-800 ring-1 ring-brand-100">
                  {e.reply}
                </p>
              </div>
            </div>
          </div>
          <p className="mt-6 text-xs text-slate-400">An example day for a dental clinic. Your assistant answers using the details you give it.</p>
        </div>
      </div>
    </section>
  );
}

// ---------- missed-call calculator ----------

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="tabular font-display text-3xl text-white">
          {value.toLocaleString()}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-brand-400"
      />
    </label>
  );
}

function MissedCalls() {
  const [missed, setMissed] = useState(8);
  const [rate, setRate] = useState(30);
  const [spend, setSpend] = useState(50);
  const yearly = useMemo(() => Math.round(missed * 52 * (rate / 100) * spend), [missed, rate, spend]);
  const customers = Math.round(missed * 52 * (rate / 100));

  return (
    <section id="cost" className="scroll-mt-16 px-3 sm:px-5">
      <div className="relative mx-auto max-w-[90rem] overflow-hidden rounded-[2rem] bg-slate-950 px-5 py-24 text-white sm:px-8">
        <div className="absolute -right-40 -top-40 size-[30rem] rounded-full bg-brand-600/25 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 size-[26rem] rounded-full bg-violet-600/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-14 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              <span className="h-px w-6 bg-slate-600" />
              What missed calls cost you
            </div>
            <h2 className="mt-4 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">
              Every unanswered call
              <br />
              <em className="text-brand-300">is a customer calling someone else.</em>
            </h2>
            <p className="mt-6 max-w-md text-lg text-slate-400">
              Move the sliders to match your business and see what's at stake in a year.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur sm:p-8">
            <div className="space-y-7">
              <Slider label="Calls you miss in a week" value={missed} min={1} max={60} onChange={setMissed} />
              <Slider label="How many would become customers" value={rate} min={5} max={100} step={5} suffix="%" onChange={setRate} />
              <Slider label="What a new customer spends" value={spend} min={5} max={1000} step={5} onChange={setSpend} />
            </div>
            <div className="mt-8 border-t border-white/10 pt-7">
              <div className="text-sm text-slate-400">Potential business missed in a year</div>
              <div className="tabular mt-1 font-display text-6xl leading-none text-white sm:text-7xl">{yearly.toLocaleString()}</div>
              <div className="mt-2 text-sm text-slate-400">
                About {customers.toLocaleString()} new customers, in your own currency.
              </div>
            </div>
            <p className="mt-6 text-xs text-slate-500">
              An estimate from the numbers you entered, not a promise. Answering calls helps, but
              customers still decide for themselves.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- features bento ----------

const GREETINGS: [string, string][] = [
  ["English", "Hello, how can I help you today?"],
  ["Español", "Hola, ¿en qué puedo ayudarle?"],
  ["Kiswahili", "Habari, nikusaidie vipi leo?"],
  ["Français", "Bonjour, comment puis-je vous aider ?"],
  ["Deutsch", "Hallo, wie kann ich Ihnen helfen?"],
  ["Português", "Olá, como posso ajudar?"],
];

function useCycle(length: number, ms: number) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % length), ms);
    return () => window.clearInterval(id);
  }, [length, ms, reduced]);
  return i;
}

function Tile({ className, title, body, children }: { className?: string; title: string; body: string; children: ReactNode }) {
  return (
    <div className={cx("flex flex-col overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white", className)}>
      <div className="relative flex flex-1 items-center justify-center bg-slate-50/70 p-6">{children}</div>
      <div className="p-6">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="mt-1.5 text-slate-600">{body}</p>
      </div>
    </div>
  );
}

function Features() {
  const g = useCycle(GREETINGS.length, 2200);
  const tidy = useCycle(2, 2600) === 1;
  return (
    <section id="features" className="scroll-mt-16 py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <Eyebrow>Features</Eyebrow>
          <h2 className="mt-4 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">
            A receptionist that <em className="text-slate-400">never takes a day off.</em>
          </h2>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-6">
          <Tile
            className="md:col-span-4"
            title="Knows your business inside out"
            body="Write your hours and prices however you like. AI tidies the wording, and you approve every change."
          >
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-medium uppercase tracking-wider text-slate-400">Opening hours</div>
              <p className={cx("mt-2 min-h-[3rem] transition-all duration-500", tidy ? "text-slate-800" : "font-mono text-sm text-slate-500")}>
                {tidy ? "Monday to Saturday, 8am–6pm. Closed on Sundays." : "mon-sat 8 to 6 sun closed"}
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-violet-600">
                <Sparkles className="size-3.5" />
                {tidy ? "Improved with AI · you approved it" : "Improve with AI"}
              </div>
            </div>
          </Tile>

          <Tile className="md:col-span-2" title="Speaks their language" body="English, Spanish, Swahili, French and more.">
            <div className="text-center">
              <div className="text-xs font-semibold uppercase tracking-wider text-brand-600">{GREETINGS[g][0]}</div>
              <p key={g} className="mt-2 font-display text-[1.75rem] leading-tight text-slate-900">
                “{GREETINGS[g][1]}”
              </p>
            </div>
          </Tile>

          <Tile className="md:col-span-2" title="Sounds like you" body="Pick a warm voice, or record 30 seconds and it speaks in yours.">
            <div className="w-full">
              <Waveform active tone="brand" bars={32} />
              <div className="mt-4 flex justify-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium shadow-sm ring-1 ring-slate-200">
                  <span className="size-2 rounded-full bg-red-500" />
                  Recording your voice · 0:24
                </span>
              </div>
            </div>
          </Tile>

          <Tile className="md:col-span-2" title="Honest, always" body="It only says what you've told it. When it doesn't know, it takes a message.">
            <div className="w-full max-w-xs space-y-2 text-sm">
              <p className="ml-auto w-fit rounded-2xl rounded-br-md bg-slate-950 px-3.5 py-2 text-white">Can I get it for half price?</p>
              <p className="w-fit rounded-2xl rounded-bl-md bg-brand-50 px-3.5 py-2 text-slate-800 ring-1 ring-brand-100">
                I can't agree to that, but I'll pass your message to the owner.
              </p>
            </div>
          </Tile>

          <Tile className="md:col-span-2" title="Try it before customers do" body="Talk to your assistant right in your browser and fine-tune it.">
            <div className="relative flex items-center justify-center">
              <span className="motion-safe-only absolute size-24 animate-ping rounded-full bg-brand-200/60" />
              <span className="relative flex size-20 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30">
                <Mic className="size-8" />
              </span>
            </div>
          </Tile>

          <div className="rounded-[1.5rem] border border-dashed border-slate-300 p-6 md:col-span-6">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold tracking-tight">Works with your tools</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Coming soon</span>
                </div>
                <p className="mt-1 text-slate-600">Book appointments, forward your existing number and get call summaries by email.</p>
              </div>
              <div className="flex flex-wrap gap-2 opacity-60 grayscale">
                {[
                  [CalendarCheck, "Calendly"],
                  [CalendarCheck, "Google Calendar"],
                  [PhoneForwarded, "Your main number"],
                  [Mail, "Email"],
                  [MessageCircle, "WhatsApp"],
                ].map(([Icon, name]) => {
                  const I = Icon as typeof Mail;
                  return (
                    <span key={name as string} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm">
                      <I className="size-4" />
                      {name as string}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- steps ----------

function Steps() {
  const steps = [
    ["Describe your business", "Answer a few simple questions about your hours, services and prices."],
    ["Hear it for yourself", "Talk to your assistant in the browser and tweak anything you'd say differently."],
    ["Switch it on", "Choose a phone number and your assistant starts answering straight away."],
  ];
  return (
    <section className="border-t border-slate-100 py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
          <div>
            <Eyebrow>Getting started</Eyebrow>
            <h2 className="mt-4 font-display text-5xl leading-[1.02] tracking-tight">
              Three minutes. <em className="text-slate-400">Three steps.</em>
            </h2>
            <PrimaryCta className="mt-8">Start now</PrimaryCta>
          </div>
          <ol className="divide-y divide-slate-200 border-y border-slate-200">
            {steps.map(([title, body], i) => (
              <li key={title} className="grid grid-cols-[4rem_1fr] gap-4 py-8 sm:grid-cols-[6rem_1fr]">
                <span className="font-display text-5xl leading-none text-slate-300 sm:text-6xl">0{i + 1}</span>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
                  <p className="mt-1.5 max-w-lg text-slate-600">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

// ---------- faq ----------

const FAQS: [string, string][] = [
  ["Do I need any technical knowledge?", "No. If you can fill in a form, you can set up CalMe. You answer a few questions about your business and we do the rest."],
  ["Will callers know it's an AI?", "It speaks naturally and politely. If a caller sincerely asks, it tells them it's the virtual assistant for your business."],
  ["What if it doesn't know the answer?", "It won't make things up. It says it doesn't have that information and offers to take a message so you can call back."],
  ["Can I keep my current number?", "You can get a new local number today. Forwarding from your existing number is coming soon."],
  ["Can I change what it says?", "Any time. Update your hours, prices or greeting and it uses them from the very next call."],
  ["Is my voice safe?", "A custom voice can only be created after you confirm it's your own voice, or that you have the speaker's permission."],
];

function Faq() {
  return (
    <section id="faq" className="scroll-mt-16 border-t border-slate-100 py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_2fr]">
        <div>
          <Eyebrow>Questions</Eyebrow>
          <h2 className="mt-4 font-display text-5xl leading-[1.02] tracking-tight">
            Good to <em className="text-slate-400">know.</em>
          </h2>
          <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
            <ShieldCheck className="size-4 text-emerald-600" />
            Honest answers, no fine print.
          </div>
        </div>
        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {FAQS.map(([q, a], i) => (
            <details key={q} className="group py-6" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium [&::-webkit-details-marker]:hidden">
                {q}
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-slate-200 transition group-open:rotate-45 group-open:bg-slate-950 group-open:text-white">
                  <Plus className="size-4" />
                </span>
              </summary>
              <p className="mt-3 max-w-2xl text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- closing ----------

function Closing() {
  return (
    <section className="px-3 pb-3 sm:px-5 sm:pb-5">
      <div className="relative mx-auto max-w-[90rem] overflow-hidden rounded-[2rem] bg-slate-950 px-5 pb-0 pt-24 text-center text-white sm:px-8">
        <div className="absolute left-1/2 top-0 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-brand-600/30 blur-3xl" />
        <h2 className="relative font-display text-6xl leading-[0.95] tracking-tight sm:text-8xl">
          Let it ring.
        </h2>
        <p className="relative mx-auto mt-6 max-w-md text-lg text-slate-400">
          Your assistant's got it. Set it up in minutes and hear it for yourself.
        </p>
        <Link
          to={SETUP}
          className="group relative mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-white pl-6 pr-2 text-[0.9375rem] font-medium text-slate-950 hover:bg-slate-100"
        >
          Set up your assistant
          <span className="flex size-8 items-center justify-center rounded-full bg-brand-500 text-white transition group-hover:translate-x-0.5">
            <ArrowRight className="size-4" />
          </span>
        </Link>
        <div className="relative mx-auto mt-20 max-w-4xl opacity-60">
          <Waveform active tone="white" bars={64} className="h-24" />
        </div>
        <footer className="relative mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 py-8 text-sm text-slate-400">
          <Logo dark />
          <div className="flex gap-6">
            <a href="#day" className="hover:text-white">A day with CalMe</a>
            <a href="#faq" className="hover:text-white">Questions</a>
            <Link to={SIGN_IN} className="hover:text-white">Sign in</Link>
          </div>
          <span>© {new Date().getFullYear()} CalMe</span>
        </footer>
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <div id="landing-scroll" className="h-full overflow-y-auto scroll-smooth bg-white text-slate-950">
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <DayTimeline />
        <MissedCalls />
        <Features />
        <Steps />
        <Faq />
        <Closing />
      </main>
    </div>
  );
}
