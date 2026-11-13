// Thin client for the CalMe API (app/api/v1). Paths are relative so the
// Vite dev proxy (or a reverse proxy in production) forwards them.
import type { SessionToken } from "@fishaudio/agent-client";

export const API_PREFIX = "/api/v1";

/** Fish Audio Live 3's own voices. Clara is the default. */
export const VOICES = ["Clara", "Nora", "Harper", "Patricia", "Owen", "Marco", "Milo", "Jonah"] as const;
export type VoiceName = (typeof VOICES)[number];

export interface Agent {
  id: string;
  name: string;
  business_name: string;
  business_description: string;
  greeting: string;
  voice: VoiceName;
  fish_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export type AgentInput = Pick<
  Agent,
  "name" | "business_name" | "business_description" | "greeting" | "voice"
>;

export type RefineField = "business_description" | "hours" | "services" | "other" | "greeting";

export interface ReadyStatus {
  status: string;
  database: string;
}

export interface SystemStatus {
  app: string;
  environment: string;
  database: "postgres" | "in-memory";
  llm: { configured: boolean; provider: "fish" | "ollama"; model: string };
  voice: { configured: boolean; model: string };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function errorFrom(res: Response): Promise<ApiError> {
  let code = "http_error";
  let message = `${res.status} ${res.statusText}`;
  try {
    const body = await res.json();
    if (body?.error) {
      code = body.error.code;
      message = body.error.message;
    } else if (Array.isArray(body?.detail)) {
      // FastAPI validation errors
      code = "validation_error";
      message = body.detail
        .map((d: { loc: string[]; msg: string }) => `${d.loc.slice(1).join(".")}: ${d.msg}`)
        .join("; ");
    } else if (typeof body?.detail === "string") {
      message = body.detail;
    } else if (typeof body?.database === "string") {
      message = body.database;
    }
  } catch {
    /* non-JSON body */
  }
  return new ApiError(res.status, code, message);
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(API_PREFIX + path, init);
  if (!res.ok) throw await errorFrom(res);
  return res;
}

async function json<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = init.body && !(init.body instanceof FormData)
    ? { "Content-Type": "application/json", ...init.headers }
    : init.headers;
  const res = await request(path, { ...init, headers });
  return res.status === 204 ? (undefined as T) : res.json();
}

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const api = {
  health: () => json<{ status: string }>("/health"),
  ready: () => json<ReadyStatus>("/ready"),
  status: () => json<SystemStatus>("/status"),

  listAgents: () => json<Agent[]>("/agents"),
  getAgent: (id: string) => json<Agent>(`/agents/${id}`),
  createAgent: (data: AgentInput) => json<Agent>("/agents", send("POST", data)),
  updateAgent: (id: string, data: Partial<AgentInput>) =>
    json<Agent>(`/agents/${id}`, send("PATCH", data)),
  deleteAgent: (id: string) => json<void>(`/agents/${id}`, send("DELETE")),
  refine: (body: {
    field: RefineField;
    text: string;
    business_name?: string;
    assistant_name?: string;
  }) => json<{ text: string }>("/assist/refine", send("POST", body)),

  /** Live voice test, hosted by Fish Audio. Hand the result to AgentSession.start(). */
  startSession: (id: string) => json<SessionToken>(`/agents/${id}/session`, send("POST")),
};

export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const units: [number, string][] = [[60, "minute"], [3600, "hour"], [86400, "day"], [604800, "week"]];
  for (let i = units.length - 1; i >= 0; i--) {
    const [size, name] = units[i];
    if (s >= size) {
      const n = Math.floor(s / size);
      if (name === "week" && n > 4) break;
      return `${n} ${name}${n === 1 ? "" : "s"} ago`;
    }
  }
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Turn API failures into sentences a business owner can act on. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "not_configured")
      return "This feature isn't switched on for your account yet. Please contact support.";
    if (err.code === "provider_error")
      return "One of our services didn't respond. Please try again in a minute.";
    if (err.code === "validation_error")
      return "Some details are missing or too short. Please check the form and try again.";
    if (err.status === 404) return "We couldn't find that. It may have been deleted.";
    if (err.status >= 500) return "Something went wrong on our side. Please try again.";
    return err.message;
  }
  if (err instanceof TypeError) return "Can't connect right now. Check your internet connection and try again.";
  if (err instanceof Error) return err.message;
  return String(err);
}

/** The original technical message, for advanced mode. */
export function technicalMessage(err: unknown): string | undefined {
  return err instanceof ApiError ? `${err.status} ${err.code}: ${err.message}` : undefined;
}
