import logging

from app.core.config import Settings
from app.core.errors import NotFoundError
from app.providers.fish_agent import FishAgents
from app.repositories.base import AgentRepository
from app.schemas.agent import Agent
from app.services.prompt_builder import build_system_prompt

logger = logging.getLogger("calme.fish_agent_sync")


def build_fish_agent_config(agent: Agent, settings: Settings) -> dict:
    """Our agent, translated into a Fish Audio agent config."""
    # Live 3 is Fish's full-duplex model: it listens while it speaks. English only.
    voice = {
        "engine": "live3",
        "live3_voice": agent.voice,
        "live3_prompt": "P2",  # phone-support pacing and turn-taking
        "speaking_language": "en",
    }

    if settings.fish_agent_llm_base_url:
        custom: dict = {
            "base_url": settings.fish_agent_llm_base_url,
            "model": settings.fish_agent_llm_custom_model,
        }
        if settings.fish_agent_llm_api_key:
            custom["api_key"] = settings.fish_agent_llm_api_key
        llm: dict = {"custom": custom}
    else:
        llm = {"model": settings.fish_agent_llm_model}

    return {
        "prompt": {
            "system_prompt": build_system_prompt(agent),
            "first_message_mode": "fixed",
            "first_message": agent.greeting,
        },
        "voice": voice,
        "llm": llm,
        "conversation": {
            "max_duration_seconds": min(max(settings.max_call_seconds, 60), 3600),
        },
    }


def _fish_name(agent: Agent) -> str:
    return f"{agent.business_name} - {agent.name}"[:120]


class FishAgentSync:
    """Keeps one hosted Fish Audio agent per CalMe agent, matching its settings."""

    def __init__(self, fish: FishAgents, repo: AgentRepository, settings: Settings) -> None:
        self._fish = fish
        self._repo = repo
        self._settings = settings

    async def push(self, agent: Agent) -> Agent:
        """Create or update the Fish agent and publish it so calls use the new settings."""
        config = build_fish_agent_config(agent, self._settings)
        if agent.fish_agent_id:
            await self._fish.update_config(agent.fish_agent_id, config)
            await self._fish.publish(agent.fish_agent_id, "CalMe update")
            return agent

        fish_id = await self._fish.create_agent(_fish_name(agent), agent.business_name, config)
        await self._fish.publish(fish_id, "CalMe initial version")
        updated = await self._repo.set_fish_agent_id(agent.id, fish_id)
        if updated is None:  # deleted while we were creating it
            await self._fish.delete_agent(fish_id)
            raise NotFoundError(f"Agent {agent.id} not found")
        logger.info("Created Fish agent %s for %s", fish_id, agent.id)
        return updated

    async def ensure(self, agent: Agent) -> Agent:
        """Make sure the agent exists at Fish, without republishing if it already does."""
        return agent if agent.fish_agent_id else await self.push(agent)

    async def remove(self, agent: Agent) -> None:
        if agent.fish_agent_id:
            await self._fish.delete_agent(agent.fish_agent_id)

    async def start_session(self, agent: Agent) -> dict:
        agent = await self.ensure(agent)
        return await self._fish.create_session(agent.fish_agent_id, str(agent.id))
