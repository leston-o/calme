import {
  ArrowRight,
  CalendarCheck,
  Check,
  Mail,
  MessageCircle,
  MessageSquareText,
  Mic,
  Moon,
  Phone,
  PhoneIncoming,
  PhoneOff,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  Sunrise,
  Utensils,
} from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import CalmeLogo from "../components/CalmeLogo";
import AmaniRobot from "../components/landing/AmaniRobot";
import VoiceClone from "../components/landing/VoiceClone";
import BookDemo from "../components/landing/BookDemo";
import { CountUp, Reveal, useInView } from "../components/landing/motion";
import { cx } from "../components/ui";
import VoiceOrb from "../components/VoiceOrb";
import Waveform from "../components/Waveform";
import { api } from "../lib/api";
import { useReducedMotion } from "../lib/hooks";
import { useRingback } from "../lib/ringback";
import { useLiveCall, type CallStatus } from "../lib/useLiveCall";

// The dashboard is closed to the public for now, so every call to action books a demo.
const BookDemoContext = createContext<() => void>(() => {});
const useBookDemo = () => useContext(BookDemoContext);

// ---------- the appointment businesses the page is built around ----------

interface Business {
  key: string;
  word: string; // sits in the headline: "Catch the bookings your … misses."
  kind: string;
  name: string;
  city: string;
  hue: number;
  photo: string; // Unsplash photo id (free to use under the Unsplash licence)
  alt: string;
  agent: string;
  time: string;
  why: string; // why nobody at the business could pick up
  asked: string;
  answer: string;
}

const BUSINESSES: Business[] = [
  {
    key: "dental",
    word: "clinic",
    kind: "Dental clinic",
    name: "Brightside Dental",
    city: "Sydney",
    hue: 210,
    photo: "1629909613654-28e377c37b09",
    alt: "Modern dental surgery with chair and lamp",
    agent: "Clara",
    time: "6:12am",
    why: "Before opening",
    asked: "Are you open this Saturday?",
    answer: "We are, from 8am to 2pm. A check-up is $120. Can I take your name so the team can book you in?",
  },
  {
    key: "salon",
    word: "salon",
    kind: "Hair salon",
    name: "Studio Lumière",
    city: "Lyon",
    hue: 280,
    photo: "1580618672591-eb180b1a973f",
    alt: "Stylist blow-drying a client's hair",
    agent: "Patricia",
    time: "2:30pm",
    why: "Everyone was with a client",
    asked: "How much is a cut and blow-dry?",
    answer: "It's €55 with a senior stylist and €45 with our junior team. Shall I take your name so we can call you back with a time?",
  },
  {
    key: "optician",
    word: "practice",
    kind: "Opticians",
    name: "ClearView Opticians",
    city: "Toronto",
    hue: 199,
    photo: "1615468822882-4828d2602857",
    alt: "Silver-framed glasses resting on glass",
    agent: "Owen",
    time: "12:50pm",
    why: "Lunch break",
    asked: "How long does an eye test take?",
    answer: "About 30 minutes, and it's free with most vision plans. Shall I take your details so the team can book you in?",
  },
  {
    key: "vet",
    word: "vet practice",
    kind: "Veterinary clinic",
    name: "Paws & Whiskers",
    city: "Nairobi",
    hue: 262,
    photo: "1770836037793-95bdbf190f71",
    alt: "Vet examining a dachshund",
    agent: "Nora",
    time: "9:10pm",
    why: "After hours",
    asked: "My dog hasn't eaten all day. What should I do?",
    answer: "I'm sorry to hear that. I'll alert the on-call vet right now so they can call you back.",
  },
  {
    key: "gym",
    word: "studio",
    kind: "Fitness studio",
    name: "Pulse Fitness",
    city: "Berlin",
    hue: 4,
    photo: "1534438327276-14e5300c3a48",
    alt: "Woman training in a gym",
    agent: "Jonah",
    time: "6:05am",
    why: "Front desk was mid-class",
    asked: "Is there a free trial class?",
    answer: "Your first class is free. Spin starts at 7 and yoga at 8. Want me to take your name for tomorrow?",
  },
];

// CalMe blue: the page's accent colour (sections may set their own).
const BRAND_HUE = 217;

const photoUrl = (id: string, width: number) =>
  `https://images.unsplash.com/photo-${id}?w=${width}&q=70&auto=format&fit=crop`;

// ---------- shared bits ----------

function Logo({ dark }: { dark?: boolean }) {
  return (
    <Link to="/" aria-label="CalMe home">
      <CalmeLogo dark={dark} />
    </Link>
  );
}

function PrimaryCta({ children, className, light }: { children: ReactNode; className?: string; light?: boolean }) {
  const book = useBookDemo();
  return (
    <button
      type="button"
      onClick={book}
      className={cx(
        "group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-full pl-6 pr-2 text-[0.9375rem] font-medium shadow-lg transition active:scale-[0.98]",
        light ? "bg-white text-slate-950 shadow-black/20" : "bg-slate-950 text-white shadow-slate-900/15",
        className,
      )}
    >
      {/* a sheen that sweeps across on hover */}
      <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/25 opacity-0 transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100" />
      {children}
      <span
        className="flex size-8 items-center justify-center rounded-full text-white transition group-hover:translate-x-0.5"
        style={{ background: "hsl(var(--hue) 85% 55%)" }}
      >
        <ArrowRight className="size-4" />
      </span>
    </button>
  );
}

function Eyebrow({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <div
      className={cx(
        "inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]",
        dark ? "text-slate-400" : "text-slate-500",
      )}
    >
      <span className={cx("h-px w-6", dark ? "bg-slate-600" : "bg-slate-300")} />
      {children}
    </div>
  );
}

function SectionTitle({ eyebrow, children, aside, dark }: { eyebrow: string; children: ReactNode; aside?: ReactNode; dark?: boolean }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
      <div>
        <Reveal>
          <Eyebrow dark={dark}>{eyebrow}</Eyebrow>
        </Reveal>
        <Reveal as="h2" variant="blur" index={1} className="mt-4 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">
          {children}
        </Reveal>
      </div>
      {aside && (
        <Reveal index={2} className={cx("max-w-md text-lg lg:justify-self-end", dark ? "text-slate-400" : "text-slate-600")}>
          {aside}
        </Reveal>
      )}
    </div>
  );
}

// ---------- nav ----------

function Nav() {
  const book = useBookDemo();
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const root = document.getElementById("landing-scroll");
    if (!root) return;
    const on = () => {
      setScrolled(root.scrollTop > 8);
      const max = root.scrollHeight - root.clientHeight;
      setProgress(max > 0 ? root.scrollTop / max : 0);
    };
    root.addEventListener("scroll", on, { passive: true });
    return () => root.removeEventListener("scroll", on);
  }, []);
  return (
    <header
      className={cx(
        "sticky top-0 z-40 transition-colors duration-300",
        scrolled ? "border-b border-slate-200/70 bg-white/75 backdrop-blur-md" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-10 px-5 sm:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-slate-600 lg:flex">
          {[
            ["#try", "Talk to Amani"],
            ["#street", "Who it's for"],
            ["#cost", "What you're losing"],
            ["#day", "How it covers you"],
            ["#pricing", "Pricing"],
            ["#faq", "Questions"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="relative py-1 hover:text-slate-950 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-slate-950 after:transition-transform hover:after:scale-x-100">
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={book}
            className="inline-flex h-9 items-center rounded-full bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 active:scale-[0.97]"
          >
            Book a demo
          </button>
        </div>
      </div>
      <div
        className="absolute bottom-0 left-0 h-[2px] origin-left"
        style={{ width: "100%", transform: `scaleX(${progress})`, background: "hsl(var(--hue) 85% 55%)" }}
      />
    </header>
  );
}

// ---------- hero: meet Amani ----------

const STATUS_TEXT: Record<CallStatus, string> = {
  idle: "Tap below and say hello",
  connecting: "Waking up…",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Amani is speaking",
};

// Each demo call is short: it costs Fish minutes, and it's a taste, not the product.
const DEMO_SECONDS = 180;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** The landing page's live demo: a real conversation with the Amani agent. */
function TryAmani() {
  const book = useBookDemo();
  // talk to Amani in its own voice, or in a temporary clone of the visitor's
  const [voiceMode, setVoiceMode] = useState<"amani" | "mine">("amani");
  const [myVoice, setMyVoice] = useState<{ ref: string; expiresAt: string } | null>(null);
  const voiceRef = voiceMode === "mine" ? myVoice?.ref : undefined;

  const startDemo = useCallback(async () => {
    try {
      return await api.demoSession(voiceRef);
    } catch (err: any) {
      // Check the code property directly instead of instanceof
      if (err?.code === "rate_limited") {
        throw new Error(err.message);
      }
      if (voiceRef && err?.status === 404) {
        setMyVoice(null); // it expired: show the recorder again
        throw new Error("Your voice copy has expired. Record it again to keep going.");
      }
    
       // Optional: log the real error to the console so you can see what's actually failing
      console.error("Demo session failed:", err);
    
       throw new Error("Amani is taking a short break. Book a demo and we'll introduce you properly.");
    }
  }, [voiceRef]);
  const call = useLiveCall(startDemo);
  // the phone rings while Amani is waking up, and stops as soon as the call connects
  const ringback = useRingback(call.status === "connecting");
  const startCall = () => {
    ringback.prime();
    void call.start();
  };
  const shown = call.lines.filter((l) => l.kind === "you" || l.kind === "agent").slice(-3);
  const problem = [...call.lines].reverse().find((l) => l.kind === "error");

  // a call counts as a demo once Amani actually picked up
  const connected = call.active && call.status !== "connecting";
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [left, setLeft] = useState(DEMO_SECONDS);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (connected && startedAt === null) setStartedAt(Date.now());
    if (!call.active && startedAt !== null) {
      setFinished(true); // however it ended: time up, hang up, or Amani ended it
      setStartedAt(null);
    }
  }, [connected, call.active, startedAt]);

  useEffect(() => {
    if (startedAt === null) return setLeft(DEMO_SECONDS);
    const tick = () => {
      const remaining = Math.max(0, DEMO_SECONDS - Math.floor((Date.now() - startedAt) / 1000));
      setLeft(remaining);
      if (remaining === 0) call.hangUp();
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [startedAt, call.hangUp]);

  const tryAgain = () => {
    setFinished(false);
    startCall();
  };

  const deleteMyVoice = () => {
    if (myVoice) void api.demoDeleteVoice(myVoice.ref).catch(() => {});
    setMyVoice(null);
  };
  const minutesLeft = myVoice ? Math.max(1, Math.round((new Date(myVoice.expiresAt).getTime() - Date.now()) / 60000)) : 0;
  const recordingVoice = voiceMode === "mine" && !myVoice && !call.active;

  return (
    <div id="try" className="relative scroll-mt-24">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/60 p-6 pt-8 shadow-2xl shadow-slate-900/10 backdrop-blur-xl sm:p-8">
        <AmaniRobot status={call.status} level={call.level} hue={voiceMode === "mine" ? 265 : 199} />

        <div className="mt-2 text-center">
          <div className="font-display text-3xl">Amani</div>
          <div className="text-sm text-slate-500">
            CalMe's demo call agent{voiceMode === "mine" && myVoice ? ", speaking in your voice" : ""}
          </div>
          {!call.active && (
            <div className="mt-4 inline-flex rounded-full bg-slate-100 p-1" role="radiogroup" aria-label="Voice for the demo">
              {(
                [
                  ["amani", "Amani's voice"],
                  ["mine", "Your voice"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  role="radio"
                  aria-checked={voiceMode === mode}
                  onClick={() => {
                    setVoiceMode(mode);
                    setFinished(false);
                  }}
                  className={cx(
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-300",
                    voiceMode === mode ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <div key={finished ? "done" : call.status} className="swap-in inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
              <span className={cx("size-1.5 rounded-full", call.active ? "bg-emerald-500" : finished ? "bg-sky-500" : "bg-slate-300")} />
              {finished && !call.active ? "Demo finished" : STATUS_TEXT[call.status]}
            </div>
            {startedAt !== null && (
              <span
                className={cx(
                  "swap-in tabular inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1",
                  left <= 30 ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-white text-slate-500 ring-slate-200",
                )}
              >
                {clock(left)} left
              </span>
            )}
          </div>
        </div>

        {recordingVoice ? (
          <VoiceClone
            onReady={(ref, expiresAt) => {
              setMyVoice({ ref, expiresAt });
              setFinished(false);
            }}
          />
        ) : finished && !call.active ? (
          <div className="swap-in mt-5 rounded-[1.5rem] bg-slate-950 p-6 text-center text-white">
            <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-white/10">
              <Sparkles className="size-5 text-sky-300" />
            </span>
            <h3 className="mt-4 font-display text-3xl leading-tight">That's the end of your demo.</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm text-slate-300">
              Thanks for talking to Amani. Book a demo with us for the full experience: a call agent set up for your
              business, with its own voice and phone number.
            </p>
            <div className="mt-5 flex justify-center">
              <PrimaryCta light>Book a demo</PrimaryCta>
            </div>
            <button onClick={tryAgain} className="mt-4 text-xs font-medium text-slate-400 underline-offset-2 hover:text-white hover:underline">
              Talk to Amani again
            </button>
          </div>
        ) : (
          <>
            {/* the conversation so far */}
            <div className="mt-5 flex min-h-[6.5rem] flex-col justify-end gap-2">
              {shown.length === 0 && !problem && (
                <p className="text-center text-sm text-slate-500">
                  Ask Amani anything a customer might: opening hours, prices, or to take a message.
                </p>
              )}
              {shown.map((l, i) => (
                <div key={`${call.lines.length}-${i}`} className={cx("bubble-in flex", l.kind === "you" && "justify-end")}>
                  <p
                    className={cx(
                      "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                      l.kind === "you" ? "rounded-br-md bg-slate-950 text-white" : "rounded-bl-md bg-sky-50 text-slate-800 ring-1 ring-sky-100",
                    )}
                  >
                    {l.text}
                  </p>
                </div>
              ))}
              {problem && !call.active && (
                <div className="swap-in rounded-2xl bg-amber-50 px-4 py-3 text-center text-sm text-amber-800 ring-1 ring-amber-200">
                  {problem.text}{" "}
                  <button onClick={book} className="font-medium underline underline-offset-2">
                    Book a demo
                  </button>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col items-center gap-2">
              {call.active ? (
                <button
                  onClick={call.hangUp}
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-red-600 px-6 text-[0.9375rem] font-medium text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 active:scale-[0.98]"
                >
                  <PhoneOff className="size-4" />
                  End conversation
                </button>
              ) : (
                <button
                  onClick={startCall}
                  className="group inline-flex h-12 items-center gap-2 rounded-full bg-slate-950 px-6 text-[0.9375rem] font-medium text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800 active:scale-[0.98]"
                >
                  <Mic className="size-4 transition group-hover:scale-110" />
                  {voiceRef ? "Talk to Amani in your voice" : "Talk to Amani"}
                </button>
              )}
              {voiceRef && !call.active && (
                <p className="text-xs text-violet-600">
                  Your voice copy is deleted in about {minutesLeft} min ·{" "}
                  <button onClick={deleteMyVoice} className="font-medium underline underline-offset-2">
                    Delete now
                  </button>
                </p>
              )}
              <p className="text-xs text-slate-400">Uses your microphone · Headphones help · {DEMO_SECONDS / 60}-minute demo</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Hero({ index }: { index: number }) {
  const biz = BUSINESSES[index];
  return (
    <section className="relative isolate overflow-hidden">
      {/* a soft wash of CalMe blue behind the hero */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 55% at 78% 35%, hsl(var(--hue) 95% 86% / 0.75), transparent 70%), radial-gradient(45% 40% at 10% 90%, hsl(calc(var(--hue) + 40) 90% 90% / 0.6), transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 -z-10 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(226 232 240 / 0.8) 1px, transparent 1px), linear-gradient(to bottom, rgb(226 232 240 / 0.8) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black, transparent)",
        }}
      />

      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 py-1 pl-1 pr-3 text-xs font-medium text-slate-600 shadow-xs backdrop-blur">
              <span className="rounded-full bg-slate-950 px-2 py-0.5 text-white">New</span>
              Missed-call cover for clinics, salons and studios
            </span>
          </Reveal>
          <h1 className="mt-7 font-display text-[3.4rem] leading-[0.95] tracking-tight text-slate-950 sm:text-7xl lg:text-[5.75rem]">
            <Reveal as="span" variant="blur" className="block">
              Catch the bookings
            </Reveal>
            <Reveal as="span" variant="blur" index={1} className="block [perspective:600px]">
              your{" "}
              <em key={biz.key} className="word-in not-italic" style={{ color: "hsl(var(--hue) 75% 45%)" }}>
                <span className="italic">{biz.word}</span>
              </em>{" "}
              misses.
            </Reveal>
          </h1>
          <Reveal index={2} as="p" className="mt-7 max-w-lg text-lg leading-relaxed text-slate-600">
            When your team can't pick up, CalMe does. It answers the question in a warm, natural voice
            and takes the caller's name and number, so a missed call stops being a lost booking.
          </Reveal>
          <Reveal index={3} className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <PrimaryCta>Book a demo</PrimaryCta>
            <a href="#try" className="inline-flex h-12 items-center gap-2 px-2 text-[0.9375rem] font-medium text-slate-700 hover:text-slate-950 lg:hidden">
              <Mic className="size-4" />
              Talk to Amani
            </a>
          </Reveal>
          <Reveal index={4} as="p" className="mt-5 text-sm text-slate-500">
            Free for your first week. Want to hear it first? Say hello to Amani →
          </Reveal>
        </div>

        <Reveal variant="scale" index={2}>
          <TryAmani />
        </Reveal>
      </div>
    </section>
  );
}

// ---------- every kind of business: a rotating showcase ----------

const SHOWCASE_MS = 6500;

function Showcase() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>(0.3);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const biz = BUSINESSES[active];

  useEffect(() => {
    if (!inView || paused || reduced) return;
    const id = window.setTimeout(() => setActive((i) => (i + 1) % BUSINESSES.length), SHOWCASE_MS);
    return () => window.clearTimeout(id);
  }, [active, inView, paused, reduced]);

  return (
    <section id="street" className="scroll-mt-16 border-t border-slate-100 py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionTitle
          eyebrow="Built for appointment businesses"
          aside="Clinics, salons, opticians, vets and studios: places where the phone rings while your hands are full. Each gets its own agent that knows its hours, prices and services."
        >
          Where a missed call <em className="text-slate-400">is a missed booking.</em>
        </SectionTitle>

        <Reveal variant="scale">
          <div
            ref={ref}
            className="mt-14 overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-xl shadow-slate-900/5"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            style={{ "--biz": biz.hue } as CSSProperties}
          >
            <div className="grid lg:grid-cols-[1.45fr_1fr]">
              {/* photos cross-fade, each slowly zooming while it's on stage */}
              <div className="relative h-72 overflow-hidden bg-slate-900 sm:h-96 lg:h-[30rem]">
                {BUSINESSES.map((b, i) => (
                  <img
                    key={b.key}
                    src={photoUrl(b.photo, 1200)}
                    alt={i === active ? b.alt : ""}
                    loading={i < 2 ? "eager" : "lazy"}
                    className={cx(
                      "absolute inset-0 size-full object-cover transition-[opacity,transform] ease-out",
                      i === active ? "scale-100 opacity-100 duration-[1200ms,7000ms]" : "scale-110 opacity-0 duration-[900ms,900ms]",
                    )}
                  />
                ))}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/10 to-transparent" />
                <div key={biz.key} className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
                  <span
                    className="swap-in inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                    style={{ background: `hsl(${biz.hue} 80% 55% / 0.9)` }}
                  >
                    {biz.kind}
                  </span>
                  <div className="swap-in mt-3 font-display text-5xl leading-none sm:text-6xl" style={{ animationDelay: "80ms" }}>
                    {biz.name}
                  </div>
                  <div className="swap-in mt-2 text-sm text-white/70" style={{ animationDelay: "160ms" }}>
                    {biz.city} · answered by {biz.agent}
                  </div>
                </div>
              </div>

              {/* the call that came in */}
              <div className="flex flex-col justify-between gap-8 p-6 sm:p-8">
                <div key={biz.key} className="space-y-4">
                  <div className="swap-in flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2 font-medium text-slate-700">
                      <span className="relative flex size-8 items-center justify-center rounded-full text-white" style={{ background: `hsl(${biz.hue} 75% 50%)` }}>
                        <PhoneIncoming className="size-4" />
                      </span>
                      {biz.why}
                    </span>
                    <span className="tabular text-slate-400">{biz.time}</span>
                  </div>
                  <div className="bubble-in flex justify-end" style={{ animationDelay: "200ms" }}>
                    <p className="max-w-[90%] rounded-2xl rounded-br-md bg-slate-950 px-4 py-3 text-[0.9375rem] text-white">{biz.asked}</p>
                  </div>
                  <div className="bubble-in flex" style={{ animationDelay: "700ms" }}>
                    <p
                      className="max-w-[90%] rounded-2xl rounded-bl-md px-4 py-3 text-[0.9375rem] text-slate-800"
                      style={{ background: `hsl(${biz.hue} 90% 96%)`, boxShadow: `inset 0 0 0 1px hsl(${biz.hue} 70% 88%)` }}
                    >
                      {biz.answer}
                    </p>
                  </div>
                  <div className="swap-in flex items-center gap-2 text-xs text-slate-500" style={{ animationDelay: "1100ms" }}>
                    <span className="size-1.5 rounded-full" style={{ background: `hsl(${biz.hue} 75% 50%)` }} />
                    {biz.agent} · {biz.name}'s call agent
                  </div>
                </div>

                {/* progress through the businesses */}
                <div className="flex gap-1.5">
                  {BUSINESSES.map((b, i) => (
                    <span key={b.key} className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span
                        key={i === active ? `${active}-${paused}` : "idle"}
                        className="block h-full origin-left rounded-full"
                        style={{
                          background: `hsl(${biz.hue} 75% 50%)`,
                          transform: i < active ? "scaleX(1)" : "scaleX(0)",
                          animation: i === active && inView && !paused && !reduced ? `fill-bar ${SHOWCASE_MS}ms linear forwards` : undefined,
                        }}
                      />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* jump straight to a business */}
        <div className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-2 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
          {BUSINESSES.map((b, i) => (
            <button
              key={b.key}
              onClick={() => setActive(i)}
              aria-pressed={i === active}
              className={cx(
                "flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-sm transition-all duration-300 active:scale-95",
                i === active ? "bg-slate-950 text-white shadow-lg" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:text-slate-950",
              )}
            >
              <img src={photoUrl(b.photo, 80)} alt="" loading="lazy" className="size-7 rounded-full object-cover" />
              {b.kind}
            </button>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">Example businesses and calls nobody on the team could take. Photos from Unsplash.</p>
      </div>
    </section>
  );
}

// ---------- Live 3: it listens while it talks ----------

const BARGE: { agent: boolean; caller: boolean; caption: string; agentText?: string; callerText?: string }[] = [
  { agent: true, caller: false, caption: "Clara is answering", agentText: "We have openings on Thursday at 10, Friday at 2, or—" },
  { agent: false, caller: true, caption: "The caller cuts in, and Clara stops straight away", callerText: "Actually, is Saturday possible?" },
  { agent: true, caller: false, caption: "Then answers what was actually asked", agentText: "Saturday works. We're open 8 to 6." },
];

function Live3() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>(0.4);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!inView || reduced) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % BARGE.length), 2600);
    return () => window.clearInterval(id);
  }, [inView, reduced]);
  const s = BARGE[step];

  return (
    <section id="live3" className="scroll-mt-16 px-3 sm:px-5" style={{ "--hue": 217 } as CSSProperties}>
      <div className="relative mx-auto max-w-[90rem] overflow-hidden rounded-[2rem] bg-slate-950 px-5 py-24 text-white sm:px-8">
        <div className="absolute -right-32 -top-40 size-[30rem] rounded-full bg-brand-600/25 blur-3xl" />
        <div className="absolute -bottom-40 -left-32 size-[26rem] rounded-full bg-violet-600/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl">
          <SectionTitle
            dark
            eyebrow="Powered by Live 3"
            aside="Most phone bots wait for you to finish, then talk over you. CalMe listens while it speaks, so it stops when a caller cuts in and answers what they actually asked."
          >
            It listens <em className="text-brand-300">while it talks.</em>
          </SectionTitle>

          <div ref={ref} className="mt-14 grid gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur sm:p-8">
            {[
              { who: "Clara · your agent", on: s.agent, text: s.agentText, color: "text-brand-300" },
              { who: "Caller", on: s.caller, text: s.callerText, color: "text-amber-300" },
            ].map((lane) => (
              <div key={lane.who} className="grid min-w-0 items-center gap-4 sm:grid-cols-[10rem_1fr]">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span className={cx("size-2 rounded-full transition", lane.on ? "bg-current" : "bg-slate-600", lane.color)} />
                  {lane.who}
                </div>
                <div className={cx("relative min-w-0 transition-opacity duration-300", lane.on ? "opacity-100" : "opacity-30", lane.color)}>
                  <Waveform active={lane.on} tone="current" bars={36} className="h-12" />
                  {lane.on && lane.text && (
                    <p key={`${step}-${lane.who}`} className="swap-in mt-2 text-[0.9375rem] text-white">
                      “{lane.text}”
                    </p>
                  )}
                </div>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between gap-4 border-t border-white/10 pt-5 text-sm">
              <span key={step} className="swap-in text-slate-300">
                {s.caption}
              </span>
              <span className="flex gap-1.5">
                {BARGE.map((_, i) => (
                  <span key={i} className={cx("h-1.5 rounded-full transition-all duration-500", i === step ? "w-6 bg-white" : "w-1.5 bg-white/30")} />
                ))}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- a day of calls ----------

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
    tag: "Front desk busy",
    icon: Sun,
    caller: "Where exactly are you? I can't find the entrance.",
    reply: "We're on the first floor above the pharmacy on Mpaka Road. The entrance is on the left side of the building.",
  },
  {
    hour: 12.7,
    time: "12:40pm",
    tag: "Lunch break",
    icon: Utensils,
    caller: "Do you accept insurance?",
    reply: "Yes, we accept most major insurance. Please bring your card to your appointment.",
  },
  {
    hour: 17.9,
    time: "5:55pm",
    tag: "Line engaged",
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
    <section id="day" className="scroll-mt-16 py-28" style={{ "--hue": 199 } as CSSProperties}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionTitle
          eyebrow="How it covers you"
          aside="Nothing changes for your team. CalMe only steps in when nobody can pick up: before opening, when the front desk is busy, and long after you've locked up. Tap a call to see how it went."
        >
          Your team answers first.
          <br />
          <em className="text-slate-400">CalMe catches the rest.</em>
        </SectionTitle>

        <Reveal variant="scale" className="mt-14 rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-xs sm:p-10">
          <div className="relative pb-10 pt-8">
            <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="absolute inset-y-0 rounded-full" style={{ left: pct(8), width: pct(10), background: "hsl(var(--hue) 90% 88%)" }} />
              {/* how far through the day the selected call is */}
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
                style={{ width: pct(e.hour), background: "linear-gradient(90deg, transparent, hsl(var(--hue) 80% 55% / 0.35))" }}
              />
            </div>
            <div className="absolute top-1 text-[0.6875rem] font-medium uppercase tracking-wider" style={{ left: pct(8), color: "hsl(var(--hue) 75% 40%)" }}>
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
                    "block rounded-full border-2 border-white shadow transition-all duration-300",
                    sel === i ? "size-5 bg-slate-950 ring-4 ring-slate-950/10" : "size-3.5 group-hover:scale-125",
                  )}
                  style={sel === i ? undefined : { background: "hsl(var(--hue) 80% 50%)" }}
                />
              </button>
            ))}
            <div className="absolute inset-x-0 bottom-0 flex justify-between text-xs text-slate-400">
              {["12am", "6am", "12pm", "6pm", "12am"].map((l, i) => (
                <span key={i}>{l}</span>
              ))}
            </div>
          </div>

          <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
            {DAY.map((d, i) => (
              <button
                key={d.time}
                onClick={() => setSel(i)}
                className={cx("shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition", sel === i ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600")}
              >
                {d.time}
              </button>
            ))}
          </div>

          <div key={sel} className="mt-6 grid gap-6 border-t border-slate-100 pt-8 lg:grid-cols-[14rem_1fr]">
            <div className="swap-in">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <e.icon className="size-4" />
                {e.tag}
              </div>
              <div className="tabular mt-1 font-display text-5xl">{e.time}</div>
            </div>
            <div className="space-y-3">
              <div className="bubble-in flex justify-end">
                <p className="max-w-lg rounded-2xl rounded-br-md bg-slate-950 px-4 py-3 text-white">{e.caller}</p>
              </div>
              <div className="bubble-in flex" style={{ animationDelay: "0.25s" }}>
                <p className="max-w-lg rounded-2xl rounded-bl-md px-4 py-3 text-slate-800" style={{ background: "hsl(var(--hue) 90% 95%)", boxShadow: "inset 0 0 0 1px hsl(var(--hue) 80% 88%)" }}>
                  {e.reply}
                </p>
              </div>
            </div>
          </div>
          <p className="mt-6 text-xs text-slate-400">Five calls a dental clinic couldn't take in one example day. Your agent answers using the details you give it.</p>
        </Reveal>
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
  const fill = ((value - min) / (max - min)) * 100;
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
        className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full accent-brand-400"
        style={{ background: `linear-gradient(90deg, rgb(96 165 250) ${fill}%, rgb(255 255 255 / 0.12) ${fill}%)` }}
      />
    </label>
  );
}

function MissedCalls() {
  const [missed, setMissed] = useState(8);
  const [rate, setRate] = useState(30);
  const [spend, setSpend] = useState(1500);
  const yearly = useMemo(() => Math.round(missed * 52 * (rate / 100) * spend), [missed, rate, spend]);
  const customers = Math.round(missed * 52 * (rate / 100));

  return (
    <section id="cost" className="scroll-mt-16 px-3 sm:px-5">
      <div className="relative mx-auto max-w-[90rem] overflow-hidden rounded-[2rem] bg-[radial-gradient(80%_60%_at_100%_0%,rgb(37_99_235/0.35),transparent),radial-gradient(60%_50%_at_0%_100%,rgb(124_58_237/0.3),transparent)] bg-slate-950 px-5 py-24 text-white sm:px-8">
        <div className="relative mx-auto grid max-w-6xl gap-14 lg:grid-cols-2 lg:items-center">
          <div>
            <Reveal>
              <Eyebrow dark>What missed calls cost you</Eyebrow>
            </Reveal>
            <Reveal as="h2" variant="blur" index={1} className="mt-4 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">
              Every call you can't take
              <br />
              <em className="text-brand-300">is a booking for someone else.</em>
            </Reveal>
            <Reveal index={2} as="p" className="mt-6 max-w-md text-lg text-slate-400">
              Callers rarely leave a voicemail. They ring the next place on the list. Move the sliders to match your business and see what that adds up to in a year.
            </Reveal>
          </div>

          <Reveal variant="scale" index={1} className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur sm:p-8">
            <div className="space-y-7">
              <Slider label="Calls you miss in a week" value={missed} min={1} max={60} onChange={setMissed} />
              <Slider label="How many would have booked" value={rate} min={5} max={100} step={5} suffix="%" onChange={setRate} />
              <Slider label="What a booking is worth to you" value={spend} min={100} max={20000} step={100} onChange={setSpend} />
            </div>
            <div className="mt-8 border-t border-white/10 pt-7">
              <div className="text-sm text-slate-400">Bookings lost to missed calls in a year</div>
              <CountUp value={yearly} className="tabular mt-1 block font-display text-6xl leading-none text-white sm:text-7xl" />
              <div className="mt-2 text-sm text-slate-400">About {customers.toLocaleString()} bookings, in your own currency.</div>
            </div>
            <p className="mt-6 text-xs text-slate-500">
              An estimate from the numbers you entered, not a promise. Answering calls helps, but customers still decide for themselves.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ---------- features ----------

const VOICES = ["Clara", "Nora", "Harper", "Patricia", "Owen", "Marco", "Milo", "Jonah"];

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

function Tile({ className, title, body, children, index }: { className?: string; title: string; body: string; children: ReactNode; index: number }) {
  return (
    <Reveal
      index={index}
      className={cx(
        "group flex flex-col overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white transition duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/5",
        className,
      )}
    >
      <div className="relative flex min-h-48 flex-1 items-center justify-center bg-slate-50/70 p-6">{children}</div>
      <div className="p-6">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="mt-1.5 text-slate-600">{body}</p>
      </div>
    </Reveal>
  );
}

function Features() {
  const tidy = useCycle(2, 2600) === 1;
  const voice = useCycle(VOICES.length, 1400);
  const orbStep = useCycle(4, 1600);
  const orbStatus = (["listening", "thinking", "speaking", "speaking"] as CallStatus[])[orbStep];

  return (
    <section id="features" className="scroll-mt-16 py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionTitle eyebrow="What your agent does">
          Cover for the calls <em className="text-slate-400">you can't get to.</em>
        </SectionTitle>

        <div className="mt-14 grid gap-4 md:grid-cols-6">
          <Tile
            index={0}
            className="md:col-span-4"
            title="Knows your business inside out"
            body="Write your hours, services and prices however you like. AI tidies the wording, and you approve every change."
          >
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-medium uppercase tracking-wider text-slate-400">Opening hours</div>
              <p key={String(tidy)} className={cx("swap-in mt-2 min-h-[3rem]", tidy ? "text-slate-800" : "font-mono text-sm text-slate-500")}>
                {tidy ? "Monday to Saturday, 8am–6pm. Closed on Sundays." : "mon-sat 8 to 6 sun closed"}
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-violet-600">
                <Sparkles className="size-3.5" />
                {tidy ? "Improved with AI · you approved it" : "Improve with AI"}
              </div>
            </div>
          </Tile>

          <Tile index={1} className="md:col-span-2" title="A voice that fits" body="Choose from eight warm, natural voices for your agent.">
            <div className="flex flex-wrap justify-center gap-1.5">
              {VOICES.map((v, i) => (
                <span
                  key={v}
                  className={cx(
                    "rounded-full px-3 py-1 text-sm transition-all duration-500",
                    i === voice ? "scale-110 bg-slate-950 text-white shadow-lg" : "bg-white text-slate-500 ring-1 ring-slate-200",
                  )}
                >
                  {v}
                </span>
              ))}
            </div>
          </Tile>

          <Tile index={2} className="md:col-span-2" title="Honest, always" body="It only says what you've told it. When it doesn't know, it takes the caller's details for you.">
            <div className="w-full max-w-xs space-y-2 text-sm">
              <p className="ml-auto w-fit rounded-2xl rounded-br-md bg-slate-950 px-3.5 py-2 text-white">Can I get it for half price?</p>
              <p className="w-fit rounded-2xl rounded-bl-md bg-brand-50 px-3.5 py-2 text-slate-800 ring-1 ring-brand-100">
                I can't agree to that, but I'll pass your message to the owner.
              </p>
            </div>
          </Tile>

          <Tile index={3} className="md:col-span-2" title="Talk to it before customers do" body="Try your agent right in your browser and fine-tune anything it says.">
            <VoiceOrb status={orbStatus} level={orbStatus === "speaking" ? 0.6 : 0.15} className="size-40" />
          </Tile>

          <Tile index={4} className="md:col-span-2" title="Only rings when you don't answer" body="Your number stays the same. Calls you can't take pass to your agent's line. US and Canadian lines today, more countries soon.">
            <div className="relative flex items-center justify-center">
              <span className="motion-safe-only absolute size-20 animate-ping rounded-full bg-emerald-200/60" />
              <span className="relative flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-lg ring-1 ring-slate-200">
                <span className="flex size-9 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Phone className="motion-safe-only size-4 animate-ring" />
                </span>
                <span className="text-left leading-tight">
                  <span className="block text-xs text-slate-400">No answer after 4 rings</span>
                  <span className="block font-display text-2xl">CalMe picks up</span>
                </span>
              </span>
            </div>
          </Tile>

          <Reveal index={5} className="rounded-[1.5rem] border border-dashed border-slate-300 p-6 md:col-span-6">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold tracking-tight">More of your business, coming soon</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Coming soon</span>
                </div>
                <p className="mt-1 text-slate-600">
                  Bookings your agent can make itself, a text to you for every lead it catches, and updates to customers by SMS and email.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  [ShoppingBag, "Your shop"],
                  [CalendarCheck, "Bookings"],
                  [MessageSquareText, "Lead texts"],
                  [Mail, "Email"],
                  [MessageCircle, "WhatsApp"],
                ].map(([Icon, name]) => {
                  const I = Icon as typeof Mail;
                  return (
                    <span key={name as string} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500 transition hover:border-slate-300 hover:text-slate-800">
                      <I className="size-4" />
                      {name as string}
                    </span>
                  );
                })}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ---------- steps, joined by a line that draws itself ----------

function Steps() {
  const [ref, inView] = useInView<HTMLOListElement>(0.3);
  const steps = [
    ["Book a demo", "Tell us a little about your business and pick a time that suits you."],
    ["We set it up for you", "We build an agent that knows your hours, services and prices, and you try it together with us."],
    ["Run it free for a week", "Calls you can't take go to your agent. Then we go through what it caught, and you decide."],
  ];
  return (
    <section className="border-t border-slate-100 py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_2fr]">
        <div>
          <Reveal>
            <Eyebrow>Getting started</Eyebrow>
          </Reveal>
          <Reveal as="h2" variant="blur" index={1} className="mt-4 font-display text-5xl leading-[1.02] tracking-tight">
            Three steps <em className="text-slate-400">to no more lost bookings.</em>
          </Reveal>
          <Reveal index={2}>
            <PrimaryCta className="mt-8">Book a demo</PrimaryCta>
          </Reveal>
        </div>
        <ol ref={ref} className="relative space-y-10 pl-16 sm:pl-24">
          <svg className="absolute bottom-6 left-[1.4rem] top-6 h-[calc(100%-3rem)] w-px overflow-visible sm:left-[2.4rem]" aria-hidden>
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="100%"
              stroke="hsl(217 85% 60%)"
              strokeWidth="2"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={inView ? 0 : 1}
              style={{ transition: "stroke-dashoffset 1.6s cubic-bezier(.2,.7,.2,1) .2s" }}
            />
          </svg>
          {steps.map(([title, body], i) => (
            <Reveal as="li" key={title} index={i + 1} className="relative">
              <span
                className={cx(
                  "absolute -left-16 top-0 flex size-11 items-center justify-center rounded-full border bg-white font-display text-2xl transition-colors duration-500 sm:-left-24 sm:size-12",
                  inView ? "border-brand-500 text-brand-600" : "border-slate-200 text-slate-300",
                )}
                style={{ transitionDelay: `${0.4 + i * 0.5}s` }}
              >
                {i + 1}
              </span>
              <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
              <p className="mt-1.5 max-w-lg text-slate-600">{body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------- pricing: free to try, flat to keep ----------

function Pricing() {
  const book = useBookDemo();
  const stages: [string, string, string][] = [
    ["Week one", "Free", "Your agent covers the calls you can't take. At the end we go through what it caught, and you decide."],
    ["Setup", "Done for you", "We build your agent from your hours, services and prices. A one-off fee, agreed before we start."],
    ["After that", "One flat price", "The same amount every month, agreed up front. No per-minute charges and no surprise bills."],
  ];
  return (
    <section id="pricing" className="scroll-mt-16 border-t border-slate-100 py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionTitle
          eyebrow="Pricing"
          aside="It should cost less than the bookings it brings back. You get your price on the demo, before you commit to anything."
        >
          Free to try. <em className="text-slate-400">Flat to keep.</em>
        </SectionTitle>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {stages.map(([when, what, body], i) => (
            <Reveal key={when} index={i} className="flex flex-col rounded-[1.5rem] border border-slate-200/80 bg-white p-6 sm:p-8">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check className="size-3" />
                </span>
                {when}
              </div>
              <div className="mt-4 font-display text-4xl leading-none tracking-tight">{what}</div>
              <p className="mt-3 text-slate-600">{body}</p>
            </Reveal>
          ))}
        </div>

        <Reveal index={3} className="mt-4 rounded-[1.5rem] border border-dashed border-slate-300 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-2xl">
              <h3 className="text-lg font-semibold tracking-tight">Already work with clinics, salons or studios?</h3>
              <p className="mt-1 text-slate-600">
                If you sell software or services to appointment businesses, you can offer CalMe to your customers and share the revenue.
              </p>
            </div>
            <button
              type="button"
              onClick={book}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-slate-950 ring-1 ring-inset ring-slate-300 transition hover:ring-slate-950 active:scale-[0.98]"
            >
              Talk to us about partnering
              <ArrowRight className="size-4" />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------- faq ----------

const FAQS: [string, string][] = [
  ["Does it replace my receptionist?", "No. Your team keeps answering the phone as they do now. CalMe only picks up the calls nobody can get to: when you're busy, on a break or closed."],
  ["What does it cost?", "Your first week is free. After that it's a one-off setup fee and one flat monthly price, agreed with you on the demo. There are no per-minute charges."],
  ["Can I keep my current number?", "Yes. Your number stays as it is. We set your phone up to pass unanswered calls to your agent's line, which is a US or Canadian number today."],
  ["Do I need any technical knowledge?", "No. Book a demo, tell us about your business, and we set your agent up with you."],
  ["Will callers know it's an AI?", "It speaks naturally and politely. If a caller sincerely asks, it tells them it's the virtual assistant for your business."],
  ["What if it doesn't know the answer?", "It won't make things up. It says it doesn't have that information and takes the caller's details so you can call back."],
  ["Can it make the booking itself?", "Not yet. Today it answers questions and takes the caller's name and number so your team can book them in. Bookings made by the agent are coming next."],
  ["Which languages does it speak?", "English today. More languages are on the way."],
  ["Can I change what it says?", "Any time. Update your hours, prices or greeting and it uses them from the very next call."],
];

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="scroll-mt-16 border-t border-slate-100 py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_2fr]">
        <div>
          <Reveal>
            <Eyebrow>Questions</Eyebrow>
          </Reveal>
          <Reveal as="h2" variant="blur" index={1} className="mt-4 font-display text-5xl leading-[1.02] tracking-tight">
            Good to <em className="text-slate-400">know.</em>
          </Reveal>
          <Reveal index={2} className="mt-6 flex items-center gap-2 text-sm text-slate-500">
            <ShieldCheck className="size-4 text-emerald-600" />
            Honest answers, no fine print.
          </Reveal>
        </div>
        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {FAQS.map(([q, a], i) => {
            const isOpen = open === i;
            return (
              <Reveal key={q} index={i} className="py-6">
                <button
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-6 text-left text-lg font-medium"
                >
                  {q}
                  <span
                    className={cx(
                      "flex size-8 shrink-0 items-center justify-center rounded-full border border-slate-200 transition duration-300",
                      isOpen && "rotate-45 border-slate-950 bg-slate-950 text-white",
                    )}
                  >
                    <Plus className="size-4" />
                  </span>
                </button>
                <div className={cx("grid transition-[grid-template-rows] duration-500 ease-out", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                  <p className={cx("overflow-hidden text-slate-600 transition-opacity duration-500", isOpen ? "opacity-100" : "opacity-0")}>
                    <span className="block max-w-2xl pt-3">{a}</span>
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------- closing ----------

function Closing() {
  return (
    <section className="px-3 pb-3 sm:px-5 sm:pb-5" style={{ "--hue": 217 } as CSSProperties}>
      <div className="relative mx-auto max-w-[90rem] overflow-hidden rounded-[2rem] bg-slate-950 px-5 pb-0 pt-24 text-center text-white sm:px-8">
        <div className="absolute left-1/2 top-0 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-brand-600/30 blur-3xl" />
        <Reveal variant="scale" className="relative mx-auto -mb-6 flex justify-center">
          <VoiceOrb status="speaking" level={0.35} className="size-40" />
        </Reveal>
        <Reveal as="h2" variant="blur" index={1} className="relative font-display text-6xl leading-[0.95] tracking-tight sm:text-8xl">
          Let it ring.
        </Reveal>
        <Reveal as="p" index={2} className="relative mx-auto mt-6 max-w-md text-lg text-slate-400">
          When you can't answer, CalMe will. Book a demo and try it free for a week.
        </Reveal>
        <Reveal index={3} className="relative mt-9">
          <PrimaryCta light>Book a demo</PrimaryCta>
        </Reveal>
        <div className="relative mx-auto mt-20 max-w-4xl opacity-60">
          <Waveform active tone="white" bars={64} className="h-24" />
        </div>
        <footer className="relative mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 py-8 text-sm text-slate-400">
          <Logo dark />
          <div className="flex gap-6">
            <a href="#street" className="hover:text-white">Who it's for</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
            <a href="#faq" className="hover:text-white">Questions</a>
          </div>
          <span>© {new Date().getFullYear()} CalMe</span>
        </footer>
      </div>
    </section>
  );
}

export default function Landing() {
  const [index, setIndex] = useState(0);
  const [booking, setBooking] = useState(false);
  const reduced = useReducedMotion();

  // the headline names a different kind of appointment business every few seconds
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % BUSINESSES.length), 3200);
    return () => window.clearInterval(id);
  }, [reduced]);

  const openBooking = useCallback(() => setBooking(true), []);

  return (
    <BookDemoContext.Provider value={openBooking}>
      <div
        id="landing-scroll"
        className="h-full overflow-y-auto overflow-x-hidden scroll-smooth bg-white text-slate-950"
        style={{ "--hue": BRAND_HUE } as CSSProperties}
      >
        <Nav />
        <main>
          <Hero index={index} />
          <Showcase />
          <MissedCalls />
          <DayTimeline />
          <Live3 />
          <Features />
          <Steps />
          <Pricing />
          <Faq />
          <Closing />
        </main>
      </div>
      <BookDemo open={booking} onClose={() => setBooking(false)} />
    </BookDemoContext.Provider>
  );
}
