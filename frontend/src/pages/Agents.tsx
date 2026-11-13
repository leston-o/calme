import { Bot, ChevronRight, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AgentStatus, { isReady } from "../components/AgentStatus";
import { Alert, Avatar, Button, cx, EmptyState, Input, PageHeader, Spinner } from "../components/ui";
import { api, errorMessage, timeAgo } from "../lib/api";
import { useAsync } from "../lib/hooks";

export default function Agents() {
  const { data, error, loading } = useAsync(() => api.listAgents());
  const [params] = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "ready" | "pending">("all");
  const navigate = useNavigate();

  // Old "?new=1" links open the setup wizard.
  useEffect(() => {
    if (params.get("new") === "1") navigate("/agents/new", { replace: true });
  }, [params, navigate]);

  const all = data ?? [];
  const counts = {
    all: all.length,
    ready: all.filter(isReady).length,
    pending: all.filter((a) => !isReady(a)).length,
  };
  const q = query.toLowerCase();
  const agents = all.filter(
    (a) =>
      (filter === "all" || (filter === "ready") === isReady(a)) &&
      (!q || a.name.toLowerCase().includes(q) || a.business_name.toLowerCase().includes(q)),
  );

  return (
    <>
      <PageHeader
        eyebrow="Your team"
        title="Assistants"
        description="Each assistant talks to customers for your business."
      />

      {error != null && (
        <div className="mb-4">
          <Alert>Couldn't load your assistants. {errorMessage(error)}</Alert>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon={<Bot className="size-5" />}
          title="No assistants yet"
          description="Set up your first assistant and try talking to it."
          action={
            <Button icon={<Plus className="size-4" />} onClick={() => navigate("/agents/new")}>
              Set up an assistant
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="flex rounded-full bg-slate-100 p-1">
              {(
                [
                  ["all", "All"],
                  ["ready", "Ready"],
                  ["pending", "Not set up"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={cx(
                    "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                    filter === key
                      ? "bg-slate-950 text-white"
                      : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  {label}
                  <span className="tabular text-xs text-slate-400">{counts[key]}</span>
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs text-slate-500">
                  <th className="px-5 py-2.5 font-medium">Assistant</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="hidden px-5 py-2.5 font-medium sm:table-cell">Voice</th>
                  <th className="hidden px-5 py-2.5 font-medium md:table-cell">Updated</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agents.map((a) => (
                  <tr
                    key={a.id}
                    className="group cursor-pointer hover:bg-slate-50/60"
                    onClick={() => navigate(`/agents/${a.id}`)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={a.name} />
                        <div className="min-w-0">
                          <Link
                            to={`/agents/${a.id}`}
                            className="block truncate font-medium text-slate-900 group-hover:text-brand-700"
                          >
                            {a.name}
                          </Link>
                          <div className="truncate text-xs text-slate-500">{a.business_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <AgentStatus agent={a} />
                    </td>
                    <td className="hidden px-5 py-3 text-slate-600 sm:table-cell">{a.voice}</td>
                    <td className="hidden whitespace-nowrap px-5 py-3 text-slate-500 md:table-cell">
                      {timeAgo(a.updated_at)}
                    </td>
                    <td className="pr-4 text-slate-300 group-hover:text-slate-500">
                      <ChevronRight className="size-4" />
                    </td>
                  </tr>
                ))}
                {agents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                      No assistants match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </>
  );
}
