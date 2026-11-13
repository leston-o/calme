import type { Agent } from "../lib/api";
import { Badge } from "./ui";

/** Ready once the hosted Fish Audio agent exists, so it can be tested live. */
export function isReady(agent: Agent) {
  return Boolean(agent.fish_agent_id);
}

export default function AgentStatus({ agent }: { agent: Agent }) {
  return isReady(agent) ? (
    <Badge tone="green" dot>
      Ready
    </Badge>
  ) : (
    <Badge tone="amber" dot>
      Not set up
    </Badge>
  );
}
