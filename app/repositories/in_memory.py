from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.repositories.base import AgentRepository
from app.schemas.agent import Agent, AgentCreate, AgentUpdate


def _now() -> datetime:
    return datetime.now(timezone.utc)


class InMemoryAgentRepository(AgentRepository):
    """Development storage. Data is lost on restart."""

    def __init__(self) -> None:
        self._items: dict[UUID, Agent] = {}

    async def create(self, data: AgentCreate) -> Agent:
        now = _now()
        agent = Agent(id=uuid4(), created_at=now, updated_at=now, **data.model_dump())
        self._items[agent.id] = agent
        return agent

    async def get(self, agent_id: UUID) -> Agent | None:
        return self._items.get(agent_id)

    async def list(self) -> list[Agent]:
        return list(self._items.values())

    async def update(self, agent_id: UUID, data: AgentUpdate) -> Agent | None:
        current = self._items.get(agent_id)
        if current is None:
            return None
        changes = data.model_dump(exclude_unset=True)  # only fields the client sent
        updated = current.model_copy(update={**changes, "updated_at": _now()})
        self._items[agent_id] = updated
        return updated

    async def delete(self, agent_id: UUID) -> bool:
        return self._items.pop(agent_id, None) is not None

    async def get_by_phone_number(self, phone_number: str) -> Agent | None:
        return next(
            (a for a in self._items.values() if a.phone_number == phone_number), None
        )

    async def set_phone_number(
        self,
        agent_id: UUID,
        phone_number: str | None,
        phone_number_sid: str | None,
        phone_provider: str | None = None,
    ) -> Agent | None:
        return self._set(
            agent_id,
            phone_number=phone_number,
            phone_number_sid=phone_number_sid,
            phone_provider=phone_provider,
        )

    async def set_fish_agent_id(
        self, agent_id: UUID, fish_agent_id: str | None
    ) -> Agent | None:
        return self._set(agent_id, fish_agent_id=fish_agent_id)

    def _set(self, agent_id: UUID, **fields) -> Agent | None:
        current = self._items.get(agent_id)
        if current is None:
            return None
        updated = current.model_copy(update={**fields, "updated_at": _now()})
        self._items[agent_id] = updated
        return updated