from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

# Fish Audio Live 3's own voices (the drive-thru-only ones are left out).
Live3Voice = Literal["Clara", "Nora", "Harper", "Patricia", "Owen", "Marco", "Milo", "Jonah"]


class AgentBase(BaseModel):
    """Fields a business provides when setting up its agent."""

    name: str = Field(min_length=1, max_length=100)
    business_name: str = Field(min_length=1, max_length=200)
    business_description: str = Field(min_length=10, max_length=10_000)
    greeting: str = Field(
        default="Hello, thanks for getting in touch. How can I help you today?",
        max_length=500,
    )
    voice: Live3Voice = "Clara"


class AgentCreate(AgentBase):
    """Request body for creating an agent."""


class AgentUpdate(BaseModel):
    """Request body for editing an agent. Every field is optional."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    business_name: str | None = Field(default=None, min_length=1, max_length=200)
    business_description: str | None = Field(
        default=None, min_length=10, max_length=10_000
    )
    greeting: str | None = Field(default=None, max_length=500)
    voice: Live3Voice | None = None


class Agent(AgentBase):
    """What the server stores and returns."""

    id: UUID
    phone_number: str | None = None 
    phone_number_sid: str | None = None
    phone_provider: str | None = None  # "twilio" or "fish": who sold the number
    fish_agent_id: str | None = None  # the hosted Fish Audio agent that takes calls
    created_at: datetime
    updated_at: datetime