from typing import Literal
from uuid import UUID

from fastapi import APIRouter, status
from pydantic import BaseModel

from app.api.deps import AgentServiceDep
from app.schemas.agent import Agent, AgentCreate, AgentUpdate

router = APIRouter(prefix="/agents", tags=["agents"])


class SessionOut(BaseModel):
    """What a browser hands to AgentSession.start() in @fishaudio/agent-client."""

    transport: Literal["livekit"]
    session_id: str
    livekit_url: str
    token: str  # single use
    expires_at: str  # passed through verbatim
    max_duration_seconds: int


@router.post("", response_model=Agent, status_code=status.HTTP_201_CREATED)
async def create_agent(data: AgentCreate, service: AgentServiceDep) -> Agent:
    return await service.create(data)


@router.get("", response_model=list[Agent])
async def list_agents(service: AgentServiceDep) -> list[Agent]:
    return await service.list()


@router.get("/{agent_id}", response_model=Agent)
async def get_agent(agent_id: UUID, service: AgentServiceDep) -> Agent:
    return await service.get(agent_id)


@router.patch("/{agent_id}", response_model=Agent)
async def update_agent(
    agent_id: UUID, data: AgentUpdate, service: AgentServiceDep
) -> Agent:
    return await service.update(agent_id, data)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(agent_id: UUID, service: AgentServiceDep) -> None:
    await service.delete(agent_id)


@router.post("/{agent_id}/sync", response_model=Agent)
async def sync_agent(agent_id: UUID, service: AgentServiceDep) -> Agent:
    """Push the agent's settings to Fish Audio again (e.g. after a failed update)."""
    return await service.sync(agent_id)


@router.post("/{agent_id}/session", response_model=SessionOut)
async def start_session(agent_id: UUID, service: AgentServiceDep) -> SessionOut:
    """Start a live in-browser call with the agent, hosted by Fish Audio."""
    session = await service.start_session(agent_id)
    return SessionOut.model_validate(session)
