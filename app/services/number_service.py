from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from uuid import UUID

from app.core.errors import ConflictError, NotConfiguredError, NotFoundError
from app.providers.base import AvailableNumber, TelephonyProvider
from app.repositories.base import AgentRepository
from app.schemas.agent import Agent


@dataclass
class PhoneLine:
    """A place to buy numbers, plus how to point a number at an agent."""

    telephony: TelephonyProvider
    route_for: Callable[[Agent], Awaitable[str]]


class NumberService:
    def __init__(
        self, repo: AgentRepository, lines: dict[str, PhoneLine], default: str
    ) -> None:
        self._repo = repo
        self._lines = lines
        self._default = default  # where new numbers are bought

    def _line(self, provider: str | None) -> PhoneLine:
        # numbers bought before Fish agents existed came from Twilio
        line = self._lines.get(provider or "twilio")
        if line is None:
            raise NotConfiguredError(f"Phone provider {provider!r} is not configured.")
        return line

    async def search(
        self,
        country: str,
        number_type: str,
        contains: str | None,
        area_code: str | None,
        limit: int,
    ) -> list[AvailableNumber]:
        return await self._line(self._default).telephony.search_numbers(
            country, number_type, contains, area_code, limit
        )

    async def _get_agent(self, agent_id: UUID) -> Agent:
        agent = await self._repo.get(agent_id)
        if agent is None:
            raise NotFoundError(f"Agent {agent_id} not found")
        return agent

    async def assign(self, agent_id: UUID, phone_number: str) -> Agent:
        agent = await self._get_agent(agent_id)
        if agent.phone_number:
            raise ConflictError("This agent already has a number. Release it first.")

        line = self._line(self._default)
        route = await line.route_for(agent)
        purchased = await line.telephony.buy_number(phone_number, route)
        try:
            updated = await self._repo.set_phone_number(
                agent_id, purchased.phone_number, purchased.sid, self._default
            )
        except Exception:
            await line.telephony.release_number(purchased.sid)  # don't pay for an orphan
            raise
        if updated is None:
            await line.telephony.release_number(purchased.sid)
            raise NotFoundError(f"Agent {agent_id} not found")
        return updated

    async def release(self, agent_id: UUID) -> Agent:
        agent = await self._get_agent(agent_id)
        if not agent.phone_number_sid:
            raise ConflictError("This agent has no number.")
        await self._line(agent.phone_provider).telephony.release_number(agent.phone_number_sid)
        updated = await self._repo.set_phone_number(agent_id, None, None, None)
        return updated or agent

    async def resync_webhook(self, agent_id: UUID) -> Agent:
        """Point the agent's number at it again (after the tunnel or Fish agent changes)."""
        agent = await self._get_agent(agent_id)
        if not agent.phone_number_sid:
            raise ConflictError("This agent has no number.")
        line = self._line(agent.phone_provider)
        await line.telephony.update_route(agent.phone_number_sid, await line.route_for(agent))
        return await self._get_agent(agent_id)
