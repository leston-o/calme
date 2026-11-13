from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.models import AgentModel
from app.repositories.base import AgentRepository
from app.schemas.agent import Agent, AgentCreate, AgentUpdate


def _to_agent(row: AgentModel) -> Agent:
    return Agent.model_validate(row, from_attributes=True)


class PostgresAgentRepository(AgentRepository):
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def create(self, data: AgentCreate) -> Agent:
        async with self._session_factory() as session:
            row = AgentModel(**data.model_dump())
            session.add(row)
            await session.commit()
            await session.refresh(row)
            return _to_agent(row)

    async def get(self, agent_id: UUID) -> Agent | None:
        async with self._session_factory() as session:
            row = await session.get(AgentModel, agent_id)
            return _to_agent(row) if row else None

    async def list(self) -> list[Agent]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(AgentModel).order_by(AgentModel.created_at)
            )
            return [_to_agent(row) for row in result.scalars()]

    async def update(self, agent_id: UUID, data: AgentUpdate) -> Agent | None:
        async with self._session_factory() as session:
            row = await session.get(AgentModel, agent_id)
            if row is None:
                return None
            for field, value in data.model_dump(exclude_unset=True).items():
                setattr(row, field, value)
            await session.commit()
            await session.refresh(row)
            return _to_agent(row)

    async def delete(self, agent_id: UUID) -> bool:
        async with self._session_factory() as session:
            row = await session.get(AgentModel, agent_id)
            if row is None:
                return False
            await session.delete(row)
            await session.commit()
            return True

    async def get_by_phone_number(self, phone_number: str) -> Agent | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(AgentModel).where(AgentModel.phone_number == phone_number)
            )
            row = result.scalar_one_or_none()
            return _to_agent(row) if row else None

    async def set_phone_number(
        self,
        agent_id: UUID,
        phone_number: str | None,
        phone_number_sid: str | None,
        phone_provider: str | None = None,
    ) -> Agent | None:
        async with self._session_factory() as session:
            row = await session.get(AgentModel, agent_id)
            if row is None:
                return None
            row.phone_number = phone_number
            row.phone_number_sid = phone_number_sid
            row.phone_provider = phone_provider
            await session.commit()
            await session.refresh(row)
            return _to_agent(row)

    async def set_fish_agent_id(
        self, agent_id: UUID, fish_agent_id: str | None
    ) -> Agent | None:
        async with self._session_factory() as session:
            row = await session.get(AgentModel, agent_id)
            if row is None:
                return None
            row.fish_agent_id = fish_agent_id
            await session.commit()
            await session.refresh(row)
            return _to_agent(row)
