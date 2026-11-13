import { Copy, Mic, PhoneOff, Store, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AgentForm from "../components/AgentForm";
import AgentStatus from "../components/AgentStatus";
import VoiceOrb from "../components/VoiceOrb";
import { Alert, Avatar, Button, Card, ConfirmModal, cx, Eyebrow, Spinner } from "../components/ui";
import { api, errorMessage, timeAgo, type Agent } from "../lib/api";
import { useAdvancedMode, useAsync } from "../lib/hooks";
import { useLiveCall, type CallStatus } from "../lib/useLiveCall";

type Tab = "try" | "business";

const TABS: { id: Tab; label: string; icon: typeof Mic }[] = [
  { id: "try", label: "Try it", icon: Mic },
  { id: "business", label: "Business", icon: Store },
];

export default function AgentDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: agent, setData: setAgent, error, loading } = useAsync(() => api.getAgent(id), [id]);

  const tab: Tab = TABS.some((t) => t.id === params.get("tab")) ? (params.get("tab") as Tab) : "try";
  const welcome = params.get("welcome") === "1";
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });

  if (loading) return <Spinner />;
  if (error || !agent) return <Alert>{error ? errorMessage(error) : "We couldn't find this assistant."}</Alert>;

  return (
    <>
      {welcome && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-emerald-900">{agent.name} is ready!</div>
            <p className="mt-0.5 text-emerald-800">
              Try talking to it below, the way a customer would. If an answer is wrong, fix it on
              the Business tab.
            </p>
          </div>
          <button onClick={() => setTab(tab)} className="text-emerald-700/60 hover:text-emerald-800" aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-5">
          <Avatar name={agent.name} size="lg" />
          <div className="min-w-0">
            <Eyebrow>{agent.business_name}</Eyebrow>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="truncate font-display text-5xl leading-none tracking-tight text-slate-950">{agent.name}</h1>
              <AgentStatus agent={agent} />
            </div>
            <div className="mt-2 text-sm text-slate-500">AI assistant · {agent.voice}'s voice</div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex gap-5 overflow-x-auto border-b border-slate-200">
        {TABS.map(({ id: t, label, icon: Icon }) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cx(
              "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-0.5 py-2.5 text-sm font-medium transition-colors",
              tab === t ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "try" && <TryTab agent={agent} />}
      {tab === "business" && (
        <BusinessTab agent={agent} onSaved={setAgent} onDeleted={() => navigate("/agents")} />
      )}
    </>
  );
}

// ---------- Try it ----------

const STATUS_LABEL: Record<CallStatus, string> = {
  idle: "Tap to start talking",
  connecting: "Connecting…",
  listening: "Listening… go ahead and speak",
  thinking: "Thinking…",
  speaking: "Speaking…",
};

function TryTab({ agent }: { agent: Agent }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Pretend you're a customer. Ask about your opening hours or prices and check the answers are
        right. If something's wrong, fix it on the <strong>Business</strong> tab.
      </p>
      <VoiceTry agent={agent} />
    </div>
  );
}

function VoiceTry({ agent }: { agent: Agent }) {
  const call = useLiveCall(agent.id);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [call.lines]);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <div className="flex flex-col items-center py-6 text-center">
          <button
            onClick={call.active ? call.hangUp : call.start}
            className="group rounded-full outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
            aria-label={call.active ? "Hang up" : `Start talking to ${agent.name}`}
          >
            <VoiceOrb
              status={call.status}
              level={call.level}
              className={cx("size-56 transition-transform duration-300", !call.active && "group-hover:scale-[1.03]")}
            />
          </button>
          <div className="mt-4 text-base font-medium">{STATUS_LABEL[call.status]}</div>
          {call.active && (
            <Button className="mt-5 !bg-red-600 !ring-red-700/40 hover:!bg-red-700" icon={<PhoneOff className="size-4" />} onClick={call.hangUp}>
              End call
            </Button>
          )}
          <p className="mt-6 max-w-xs text-xs text-slate-500">
            Your browser will ask to use your microphone. Headphones work best.
          </p>
        </div>
      </Card>
      <Card className="lg:col-span-3" title="Conversation">
        <div className="h-[22rem] space-y-2 overflow-y-auto">
          {call.lines.length === 0 && (
            <p className="py-16 text-center text-sm text-slate-400">What you and {agent.name} say will appear here.</p>
          )}
          {call.lines.map((l, i) =>
            l.kind === "system" ? (
              <div key={i} className="text-center text-xs text-slate-400">
                {l.text.startsWith("Connected") ? `Connected to ${agent.name}` : l.text}
              </div>
            ) : l.kind === "error" ? (
              <Alert key={i}>{l.text}</Alert>
            ) : (
              <Bubble key={i} role={l.kind === "you" ? "user" : "assistant"} text={l.text} />
            ),
          )}
          <div ref={end} />
        </div>
      </Card>
    </div>
  );
}

function Bubble({ role, text, muted }: { role: "user" | "assistant"; text: string; muted?: boolean }) {
  const mine = role === "user";
  return (
    <div className={cx("flex", mine && "justify-end")}>
      <div
        className={cx(
          "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
          mine ? "rounded-br-md bg-slate-950 text-white" : "rounded-bl-md bg-brand-50 text-slate-800 ring-1 ring-brand-100",
          muted && "text-slate-500",
        )}
      >
        {text}
      </div>
    </div>
  );
}

// ---------- Business ----------

function BusinessTab({ agent, onSaved, onDeleted }: { agent: Agent; onSaved: (a: Agent) => void; onDeleted: () => void }) {
  const [advanced] = useAdvancedMode();
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string }>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    try {
      await api.deleteAgent(agent.id);
      onDeleted();
    } catch (err) {
      setMsg({ tone: "error", text: errorMessage(err) });
      setConfirmDelete(false);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card title="Your business" description="What your assistant knows and how it sounds. Changes apply to the next conversation.">
        {msg && (
          <div className="mb-4">
            <Alert tone={msg.tone} onClose={() => setMsg(undefined)}>
              {msg.text}
            </Alert>
          </div>
        )}
        <AgentForm
          key={agent.updated_at}
          initial={agent}
          submitLabel="Save changes"
          onSubmit={async (input) => {
            try {
              onSaved(await api.updateAgent(agent.id, input));
              setMsg({ tone: "success", text: "Saved. Your assistant will use this in the next conversation." });
            } catch (err) {
              setMsg({ tone: "error", text: errorMessage(err) });
            }
          }}
        />
      </Card>

      {advanced && (
        <Card title="Technical details">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Detail label="Agent ID">
              <span className="flex items-center gap-1.5">
                <code className="truncate text-xs">{agent.id}</code>
                <button className="text-slate-400 hover:text-slate-600" onClick={() => navigator.clipboard?.writeText(agent.id)} aria-label="Copy ID">
                  <Copy className="size-3.5" />
                </button>
              </span>
            </Detail>
            <Detail label="Fish Audio agent">{agent.fish_agent_id ?? "Not created yet"}</Detail>
            <Detail label="Created">{new Date(agent.created_at).toLocaleString()}</Detail>
            <Detail label="Updated">
              {new Date(agent.updated_at).toLocaleString()} ({timeAgo(agent.updated_at)})
            </Detail>
          </dl>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-100 bg-red-50/40 p-5">
        <div>
          <div className="text-sm font-semibold text-slate-900">Delete this assistant</div>
          <p className="text-sm text-slate-500">It will stop talking to customers and can't be brought back.</p>
        </div>
        <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title={`Delete ${agent.name}?`}
        danger
        loading={deleting}
        confirmLabel="Delete assistant"
        message={<p>{agent.name} will be permanently deleted. This can't be undone.</p>}
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-all text-slate-800">{children}</dd>
    </div>
  );
}
