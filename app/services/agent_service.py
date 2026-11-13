import logging
from uuid import UUID

from app.core.errors import AppError, NotConfiguredError, NotFoundError
from app.repositories.base import AgentRepository
from app.schemas.agent import Agent, AgentCreate, AgentUpdate
from app.services.fish_agent_sync import FishAgentSync

logger = logging.getLogger("calme.agents")


class AgentService:
    def __init__(self, repo: AgentRepository, fish: FishAgentSync | None = None) -> None:
        self._repo = repo
        self._fish = fish

    async def create(self, data: AgentCreate) -> Agent:
        agent = await self._repo.create(data)
        if self._fish is None:
            return agent
        try:
            return await self._fish.push(agent)
        except AppError:
            await self._repo.delete(agent.id)  # don't keep an agent that can't take calls
            raise

    async def get(self, agent_id: UUID) -> Agent:
        agent = await self._repo.get(agent_id)
        if agent is None:
            raise NotFoundError(f"Agent {agent_id} not found")
        return agent

    async def list(self) -> list[Agent]:
        return await self._repo.list()

    async def update(self, agent_id: UUID, data: AgentUpdate) -> Agent:
        agent = await self._repo.update(agent_id, data)
        if agent is None:
            raise NotFoundError(f"Agent {agent_id} not found")
        if self._fish is not None:
            agent = await self._fish.push(agent)  # on failure, POST /sync retries
        return agent

    async def sync(self, agent_id: UUID) -> Agent:
        """Push the agent's current settings to Fish Audio again."""
        return await self._require_fish().push(await self.get(agent_id))

    async def start_session(self, agent_id: UUID) -> dict:
        return await self._require_fish().start_session(await self.get(agent_id))

    async def delete(self, agent_id: UUID) -> None:
        agent = await self.get(agent_id)
        if self._fish is not None:
            try:
                await self._fish.remove(agent)
            except NotFoundError:
                pass
            except AppError:
                logger.warning("Could not delete Fish agent %s", agent.fish_agent_id)
                raise
        if not await self._repo.delete(agent_id):
            raise NotFoundError(f"Agent {agent_id} not found")

    def _require_fish(self) -> FishAgentSync:
        if self._fish is None:
            raise NotConfiguredError(
                "Fish Audio agents are not configured. Set CALME_FISH_API_KEY."
            )
        return self._fish
