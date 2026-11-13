import { useCallback, useEffect, useRef, useState } from "react";
import { AgentSession, FishAgentError, type EndReason } from "@fishaudio/agent-client";
import { api, errorMessage } from "./api";

// The call itself runs on Fish Audio: our backend creates a session token for the
// agent, and the SDK connects the microphone and speaker over WebRTC. Listening,
// barge-in and turn-taking all happen on Fish's side.

export type CallStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking";

export interface CallLine {
  kind: "you" | "agent" | "system" | "error";
  text: string;
}

const END_REASON: Record<EndReason, string> = {
  user_hangup: "Call ended",
  agent_hangup: "Call ended",
  conversation_timeout: "Call ended: time limit reached",
  escalated: "Call ended: transferred",
  llm_endpoint_failure: "Call ended: the assistant stopped responding",
  internal_error: "Call ended: something went wrong",
  connection_lost: "Call ended: connection lost",
};

function callErrorMessage(err: unknown): string {
  if (err instanceof FishAgentError) {
    if (err.code === "mic_permission_denied")
      return "We couldn't use your microphone. Allow microphone access in your browser and try again.";
    if (err.code === "insufficient_credit") return "Calls are paused because the voice account is out of credit.";
    if (err.code === "connection_failed" || err.code === "session_expired")
      return "Couldn't connect the call. Please try again.";
    return err.message;
  }
  return errorMessage(err);
}

export function useLiveCall(agentId: string) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [lines, setLines] = useState<CallLine[]>([]);
  const [level, setLevel] = useState(0);
  const s = useRef({
    session: null as AgentSession | null,
    starting: false,
    frame: 0,
  }).current;

  const log = useCallback((kind: CallLine["kind"], text: string) => {
    setLines((l) => [...l, { kind, text }]);
  }, []);

  const stopMeter = useCallback(() => {
    cancelAnimationFrame(s.frame);
    setLevel(0);
  }, [s]);

  const startMeter = useCallback(() => {
    const tick = () => {
      if (!s.session) return;
      // follow whoever is talking: the agent while it speaks, the customer otherwise
      const volume =
        s.session.mode === "speaking" ? s.session.getOutputVolume() : s.session.getInputVolume();
      setLevel(Math.min(1, volume * 1.5));
      s.frame = requestAnimationFrame(tick);
    };
    s.frame = requestAnimationFrame(tick);
  }, [s]);

  const start = useCallback(async () => {
    if (s.session || s.starting) return;
    s.starting = true;
    setLines([]);
    setStatus("connecting");
    try {
      const sessionToken = await api.startSession(agentId);
      const session = await AgentSession.start({
        sessionToken,
        callbacks: {
          onConnect: () => log("system", "Connected"),
          onModeChange: (mode) => setStatus(mode),
          onMessage: ({ role, text }) => log(role === "user" ? "you" : "agent", text),
          onError: (err) => {
            if (err.recovered) return; // the agent answers this turn anyway
            log("error", callErrorMessage(err));
          },
          onDisconnect: ({ reason }) => {
            log("system", END_REASON[reason] ?? "Call ended");
            s.session = null;
            stopMeter();
            setStatus("idle");
          },
        },
      });
      s.session = session;
      setStatus(session.mode);
      startMeter();
    } catch (err) {
      log("error", callErrorMessage(err));
      setStatus("idle");
    } finally {
      s.starting = false;
    }
  }, [agentId, s, log, startMeter, stopMeter]);

  const hangUp = useCallback(() => {
    void s.session?.end();
  }, [s]);

  useEffect(
    () => () => {
      cancelAnimationFrame(s.frame);
      void s.session?.end();
    },
    [s],
  );

  return { status, lines, level, start, hangUp, active: status !== "idle" };
}
