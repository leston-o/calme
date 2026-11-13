import { ArrowRight, Mic, PencilLine, Plus, Sparkles, Wand2 } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { isReady } from "../components/AgentStatus";
import { Alert, Badge, Card, cx, Eyebrow, Spinner } from "../components/ui";
import Waveform from "../components/Waveform";
import { api, errorMessage, timeAgo, type Agent, type SystemStatus } from "../lib/api";
import { useAdvancedMode, useAsync } from "../lib/hooks";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** Dark pill link with the blue arrow, matching the landing page CTA. */
function PillLink({ to, children, light }: { to: string; children: ReactNode; light?: boolean }) {
  return (
    <Link
      to={to}
      className={cx(
        "group inline-flex h-11 items-center gap-2 rounded-full pl-5 pr-1.5 text-sm font-medium transition",
        light ? "bg-white text-slate-950 hover:bg-slate-100" : "bg-slate-950 text-white hover:bg-slate-800",
      )}
    >
      {children}
      <span className="flex size-8 items-center justify-center rounded-full bg-brand-500 text-white transition group-hover:translate-x-0.5">
        <ArrowRight className="size-4" />
      </span>
    </Link>
  );
}

function Welcome() {
  const steps = [
    { icon: Wand2, title: "Describe your business", body: "Hours, services and prices, like briefing a new receptionist." },
    { icon: Mic, title: "Hear it for yourself", body: "Talk to your assistant before any customer does." },
    { icon: PencilLine, title: "Sharpen its answers", body: "Fix anything it got wrong, then try again." },
  ];
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white px-6 py-16 text-center sm:px-12">
      <div className="absolute left-1/2 top-0 -z-0 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl" />
      <div className="relative">
        <Eyebrow>Let's get you set up</Eyebrow>
        <h2 className="mt-5 font-display text-5xl leading-[0.98] tracking-tight sm:text-7xl">
          Customers ask.
          <br />
          <em className="bg-gradient-to-r from-brand-600 via-violet-500 to-brand-500 bg-clip-text text-transparent">
            You stay calm.
          </em>
        </h2>
        <p className="mx-auto mt-6 max-w-md text-slate-600">
          Set up an assistant that answers your customers' questions, 24 hours a day. It takes
          about 3 minutes.
        </p>
        <div className="mt-8">
          <PillLink to="/agents/new">Set up my assistant</PillLink>
        </div>
        <ol className="mx-auto mt-14 grid max-w-4xl gap-4 text-left sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 backdrop-blur">
              <div className="flex items-center justify-between">
                <Icon className="size-5 text-slate-400" />
                <span className="font-display text-3xl text-slate-200">0{i + 1}</span>
              </div>
              <div className="mt-3 font-medium">{title}</div>
              <p className="mt-1 text-sm text-slate-500">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** Styled like the landing page's live-call card: who it talks for, its voice, and a way to try it. */
function AssistantCard({ agent }: { agent: Agent }) {
  const ready = isReady(agent);
  return (
    <div className="flex flex-col overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white">
      <div className="flex-1 bg-slate-50/70 p-6">
        <div className="flex items-center justify-between">
          {ready ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/15">
              <span className="size-2 rounded-full bg-emerald-500" />
              Ready to try
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-600/15">
              <span className="size-2 rounded-full bg-amber-500" />
              Not set up
            </span>
          )}
          <Link to={`/agents/${agent.id}?tab=business`} className="text-sm font-medium text-slate-500 hover:text-slate-950">
            Edit
          </Link>
        </div>
        <div className="mt-6 text-xs font-medium uppercase tracking-wider text-slate-400">Assistant for</div>
        <Link to={`/agents/${agent.id}`} className="mt-1 block font-display text-4xl leading-tight text-slate-950 hover:text-brand-700">
          {agent.business_name}
        </Link>
        <div className="mt-1 text-sm text-slate-500">
          {agent.name} · AI assistant · {agent.voice}'s voice
        </div>
        <Waveform active={ready} tone={ready ? "brand" : "slate"} bars={40} className="mt-6 h-10" />
      </div>
      <div className="border-t border-slate-100 p-6">
        <p className="text-sm text-slate-600">
          Talk to {agent.name} the way a customer would and check its answers.
        </p>
        <div className="mt-5">
          <PillLink to={`/agents/${agent.id}?tab=try`}>Try it</PillLink>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-[1.25rem] border border-slate-200/80 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</div>
      <div className="tabular mt-1 font-display text-4xl leading-none">{value}</div>
    </div>
  );
}

type Health = "ok" | "warn" | "down" | "unknown";

const HEALTH: Record<Health, { tone: "green" | "amber" | "red" | "slate"; label: string }> = {
  ok: { tone: "green", label: "Operational" },
  warn: { tone: "amber", label: "Attention" },
  down: { tone: "red", label: "Unavailable" },
  unknown: { tone: "slate", label: "Unknown" },
};

function HealthRow({ name, detail, state }: { name: string; detail: string; state: Health }) {
  const h = HEALTH[state];
  return (
    <li className="flex items-center justify-between gap-3 px-6 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-950">{name}</div>
        <div className="truncate text-xs text-slate-500">{detail}</div>
      </div>
      <Badge tone={h.tone} dot>
        {h.label}
      </Badge>
    </li>
  );
}

/** Technical service status; shown in advanced mode only. */
function SystemHealth() {
  const ready = useAsync(() => api.ready());
  const status = useAsync<SystemStatus | null>(() => api.status().catch(() => null));
  const s = status.data;
  const apiDown = ready.error != null;
  const known = (configured: boolean | undefined): Health =>
    apiDown ? "down" : configured === undefined ? "unknown" : configured ? "ok" : "warn";

  return (
    <Card title="System health" flush>
      <ul className="divide-y divide-slate-100">
        <HealthRow
          name="API"
          detail={apiDown ? "Not reachable" : s ? `${s.app} · ${s.environment}` : "Responding"}
          state={ready.loading ? "unknown" : apiDown ? "down" : "ok"}
        />
        <HealthRow
          name="Database"
          detail={ready.data?.database === "in-memory" ? "In-memory (data is lost on restart)" : "PostgreSQL"}
          state={ready.loading ? "unknown" : apiDown ? "down" : ready.data?.database === "connected" ? "ok" : "warn"}
        />
        <HealthRow
          name="Language model"
          detail={s ? `${s.llm.provider === "fish" ? "Fish Audio agent" : "Ollama"} · ${s.llm.model}` : "Checking…"}
          state={known(s?.llm.configured)}
        />
        <HealthRow
          name="Voice"
          detail={s ? (s.voice.configured ? "Fish Audio · Live 3" : "Set CALME_FISH_API_KEY") : "Fish Audio"}
          state={known(s?.voice.configured)}
        />
      </ul>
    </Card>
  );
}

export default function Overview() {
  const agents = useAsync(() => api.listAgents());
  const [advanced] = useAdvancedMode();

  const list = [...(agents.data ?? [])].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const ready = list.filter(isReady).length;
  const status =
    list.length === 0
      ? undefined
      : ready === list.length
        ? ready === 1
          ? "Your assistant is ready to try."
          : `All ${ready} assistants are ready to try.`
        : `${ready} of ${list.length} assistants are ready to try.`;

  return (
    <>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <Eyebrow>
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </Eyebrow>
          <h1 className="mt-4 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">
            {greeting()}.
            {status && (
              <>
                <br />
                <em className="text-slate-400">{status}</em>
              </>
            )}
          </h1>
        </div>
        {list.length > 0 && (
          <Link
            to="/agents/new"
            className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
          >
            <Plus className="size-4" />
            Add another assistant
          </Link>
        )}
      </div>

      {agents.error != null && (
        <div className="mb-6">
          <Alert>Couldn't load your assistants. {errorMessage(agents.error)}</Alert>
        </div>
      )}

      {agents.loading ? (
        <Spinner />
      ) : list.length === 0 && agents.error == null ? (
        <Welcome />
      ) : (
        <div className={cx("grid gap-6", advanced && "xl:grid-cols-3")}>
          <div className={cx("space-y-4", advanced && "xl:col-span-2")}>
            <div className="grid gap-4 lg:grid-cols-2">
              {list.slice(0, 6).map((a) => (
                <AssistantCard key={a.id} agent={a} />
              ))}
            </div>
            {list.length > 6 && (
              <Link to="/agents" className="block text-center text-sm font-medium text-slate-600 hover:text-slate-950">
                See all {list.length} assistants →
              </Link>
            )}
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <Sparkles className="size-3.5" />
              Last updated {timeAgo(list[0].updated_at)}. Changes apply from the next conversation.
            </p>
          </div>
          {advanced && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <Kpi label="Assistants" value={list.length} />
                <Kpi label="Ready" value={ready} />
              </div>
              <SystemHealth />
            </div>
          )}
        </div>
      )}
    </>
  );
}
