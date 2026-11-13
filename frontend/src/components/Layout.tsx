import {
  BookOpen,
  Settings2,
  Bot,
  ChevronRight,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, matchPath, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api, type Agent } from "../lib/api";
import { useAdvancedMode, useAsync } from "../lib/hooks";
import CalmeLogo from "./CalmeLogo";
import { Avatar, Button, cx } from "./ui";

type NavItem = { to: string; label: string; icon: typeof Bot; end?: boolean };

const mainNav: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/agents", label: "Assistants", icon: Bot },
];

function SystemStatus() {
  const { data, error } = useAsync(() => api.ready());
  const ok = data?.status === "ok";
  return (
    <div className="rounded-2xl bg-slate-50 p-3.5 ring-1 ring-inset ring-slate-200/70">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
        <span className="relative flex size-2">
          {ok && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          )}
          <span
            className={cx(
              "relative inline-flex size-2 rounded-full",
              error ? "bg-red-500" : ok ? "bg-emerald-500" : "bg-slate-300",
            )}
          />
        </span>
        {error ? "Can't connect" : ok ? "Everything is working" : "Checking…"}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {error ? "Check your internet, or try again shortly." : "All services are running normally."}
      </p>
    </div>
  );
}

function NavGroup({
  heading,
  items,
  onNavigate,
}: {
  heading?: string;
  items: NavItem[];
  onNavigate?: () => void;
}) {
  return (
    <div>
      {heading && (
        <div className="mb-2 px-3.5 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {heading}
        </div>
      )}
      <div className="space-y-0.5">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cx(
                "group flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-slate-950 text-white shadow-sm shadow-slate-900/10"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cx(
                    "size-4",
                    isActive ? "text-brand-400" : "text-slate-400 group-hover:text-slate-600",
                  )}
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const [advanced, setAdvanced] = useAdvancedMode();
  return (
    <div className="flex h-full flex-col">
      <Link to="/" className="flex h-16 items-center px-6" aria-label="CalMe home">
        <CalmeLogo />
      </Link>
      <nav className="flex-1 space-y-7 px-4 pt-6">
        <NavGroup items={mainNav} onNavigate={onNavigate} />
      </nav>
      <div className="space-y-3 p-4">
        {advanced && (
          <a
            href="/docs"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-full px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950"
          >
            <BookOpen className="size-4 text-slate-400" />
            API reference
          </a>
        )}
        <SystemStatus />
        <label className="flex cursor-pointer items-center justify-between gap-2 rounded-full px-3.5 py-2 text-xs text-slate-500 hover:bg-slate-100">
          <span className="flex items-center gap-2">
            <Settings2 className="size-3.5" />
            Advanced mode
          </span>
          <input
            type="checkbox"
            className="peer sr-only"
            checked={advanced}
            onChange={(e) => setAdvanced(e.target.checked)}
          />
          <span className="relative h-4 w-7 rounded-full bg-slate-300 transition peer-checked:bg-slate-950 after:absolute after:left-0.5 after:top-0.5 after:size-3 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-3" />
        </label>
      </div>
    </div>
  );
}

const TITLES: [string, string][] = [
  ["/agents", "Assistants"],
];

function Breadcrumbs() {
  const { pathname } = useLocation();
  const isNew = pathname === "/agents/new";
  const detail = isNew ? null : matchPath("/agents/:id", pathname);
  const { data: agent } = useAsync(
    () => (detail ? api.getAgent(detail.params.id!) : Promise.resolve(undefined)),
    [detail?.params.id],
  );
  const section = TITLES.find(([p]) => pathname.startsWith(p));
  const crumbs: { label: string; to?: string }[] = section
    ? [{ label: section[1], to: detail || isNew ? section[0] : undefined }]
    : [{ label: "Home" }];
  if (detail) crumbs.push({ label: agent?.name ?? "…" });
  if (isNew) crumbs.push({ label: "New assistant" });

  return (
    <nav className="flex min-w-0 items-center gap-1.5 text-sm">
      {crumbs.map((c, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1.5">
          {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-slate-300" />}
          {c.to ? (
            <Link to={c.to} className="text-slate-500 hover:text-slate-800">
              {c.label}
            </Link>
          ) : (
            <span className="truncate font-medium text-slate-900">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** Jump to an agent by name, business or number. Press "/" to focus. */
function QuickSearch() {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>();
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const load = () => {
    setOpen(true);
    api.listAgents().then(setAgents, () => setAgents([]));
  };

  const q = query.trim().toLowerCase();
  const results = (agents ?? [])
    .filter(
      (a) =>
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.business_name.toLowerCase().includes(q),
    )
    .slice(0, 6);

  const go = (a: Agent) => {
    navigate(`/agents/${a.id}`);
    setQuery("");
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div className="relative hidden w-72 md:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input
        ref={input}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onFocus={load}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((i) => Math.min(i + 1, results.length - 1));
          else if (e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0));
          else if (e.key === "Enter" && results[active]) go(results[active]);
          else if (e.key === "Escape") input.current?.blur();
        }}
        placeholder="Find an assistant…"
        className="h-9 w-full rounded-full border border-slate-200 bg-slate-50/60 pl-9 pr-9 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-950/5"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 text-[0.6875rem] font-medium text-slate-400">
        /
      </kbd>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-xl">
          {agents === undefined ? (
            <div className="px-3 py-2 text-sm text-slate-500">Loading…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">No matching assistants</div>
          ) : (
            results.map((a, i) => (
              <button
                key={a.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(a)}
                onMouseEnter={() => setActive(i)}
                className={cx(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left",
                  i === active && "bg-slate-50",
                )}
              >
                <Avatar name={a.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{a.name}</span>
                  <span className="block truncate text-xs text-slate-500">{a.business_name}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200/80 bg-white lg:block">
        <Sidebar />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-72 bg-white shadow-xl">
            <button
              className="absolute right-3 top-4 text-slate-400"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur-md sm:px-10">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="-ml-1 text-slate-500 lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          <Breadcrumbs />
          <div className="ml-auto flex items-center gap-2">
            <QuickSearch />
            <Link to="/agents/new">
              <Button icon={<Plus className="size-4" />}>
                <span className="hidden sm:inline">New assistant</span>
              </Button>
            </Link>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-white">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
