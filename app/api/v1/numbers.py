from dataclasses import asdict
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.api.deps import NumberServiceDep
from app.schemas.agent import Agent

router = APIRouter(tags=["numbers"])


class AvailableNumberOut(BaseModel):
    phone_number: str
    friendly_name: str
    locality: str | None = None
    region: str | None = None
    country: str
    number_type: str
    address_required: bool


class AssignNumberRequest(BaseModel):
    phone_number: str = Field(pattern=r"^\+[1-9]\d{6,14}$")  # E.164, e.g. +14155550123


@router.get("/numbers/available", response_model=list[AvailableNumberOut])
async def list_available_numbers(
    service: NumberServiceDep,
    country: str = Query(min_length=2, max_length=2, description="ISO code, e.g. US, KE"),
    number_type: Literal["local", "mobile", "toll_free"] = Query("local", alias="type"),
    contains: str | None = Query(default=None, max_length=10),
    area_code: str | None = Query(default=None, max_length=6),
    limit: int = Query(default=20, ge=1, le=50),
) -> list[AvailableNumberOut]:
    """The list your frontend shows when a business picks a number."""
    numbers = await service.search(country, number_type, contains, area_code, limit)
    return [AvailableNumberOut(**asdict(n)) for n in numbers]


@router.post("/agents/{agent_id}/number", response_model=Agent)
async def buy_number_for_agent(
    agent_id: UUID, body: AssignNumberRequest, service: NumberServiceDep
) -> Agent:
    """Buys the number (this costs money) and connects it to the agent."""
    return await service.assign(agent_id, body.phone_number)


@router.delete("/agents/{agent_id}/number", response_model=Agent)
async def release_agent_number(agent_id: UUID, service: NumberServiceDep) -> Agent:
    """Gives the number back to its provider so you stop paying for it."""
    return await service.release(agent_id)


@router.post("/agents/{agent_id}/number/sync-webhook", response_model=Agent)
async def sync_number_webhook(agent_id: UUID, service: NumberServiceDep) -> Agent:
    """Re-point the number at the agent (Fish) or the current CALME_PUBLIC_BASE_URL (Twilio)."""
    return await service.resync_webhook(agent_id)