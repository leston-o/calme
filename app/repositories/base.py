from abc import ABC, abstractmethod
from uuid import UUID

from app.schemas.agent import Agent, AgentCreate, AgentUpdate


class AgentRepository(ABC):
    """Storage contract. Swap the implementation without touching routes."""

    @abstractmethod
    async def create(self, data: AgentCreate) -> Agent: ...

    @abstractmethod
    async def get(self, agent_id: UUID) -> Agent | None: ...

    @abstractmethod
    async def list(self) -> list[Agent]: ...

    @abstractmethod
    async def update(self, agent_id: UUID, data: AgentUpdate) -> Agent | None: ...

    @abstractmethod
    async def delete(self, agent_id: UUID) -> bool: ...

    @abstractmethod
    async def get_by_phone_number(self, phone_number: str) -> Agent | None: ...

    @abstractmethod
    async def set_phone_number(
        self,
        agent_id: UUID,
        phone_number: str | None,
        phone_number_sid: str | None,
        phone_provider: str | None = None,
    ) -> Agent | None: ...

    @abstractmethod
    async def set_fish_agent_id(
        self, agent_id: UUID, fish_agent_id: str | None
    ) -> Agent | None: ...