"""Public endpoints for the landing page: book a demo, and talk to the demo agent."""

import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Request, status
from pydantic import BaseModel, Field

from app.api.deps import AgentServiceDep
from app.api.v1.agents import SessionOut
from app.core.errors import NotConfiguredError
from app.core.rate_limit import client_ip

logger = logging.getLogger("calme.demo")

router = APIRouter(prefix="/demo", tags=["demo"])

EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class DemoRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(max_length=200, pattern=EMAIL_PATTERN)
    business: str = Field(min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    preferred_time: str | None = Field(default=None, max_length=100)
    message: str | None = Field(default=None, max_length=2000)
    # Hidden on the form. People leave it empty; bots fill it in.
    website: str | None = Field(default=None, max_length=200)


class DemoRequestOut(BaseModel):
    ok: bool = True


def _one_line(value: str | None) -> str:
    return " ".join((value or "").split()) or "-"


@router.post("/requests", response_model=DemoRequestOut, status_code=status.HTTP_202_ACCEPTED)
async def book_demo(body: DemoRequest, request: Request) -> DemoRequestOut:
    """Email a demo request to the CalMe team."""
    state = request.app.state
    if body.website:
        logger.info("Dropped a demo request that filled the honeypot")
        return DemoRequestOut()  # look successful so bots don't adapt

    email = getattr(state, "email", None)
    if email is None:
        raise NotConfiguredError("Demo booking isn't set up yet. Set the CALME_SMTP_* settings.")

    ip = client_ip(request)
    state.demo_request_limit.check(ip, "You've sent a few requests already. We'll be in touch soon.")

    settings = state.settings
    sent_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    text = (
        "New CalMe demo request\n\n"
        f"Name:           {_one_line(body.name)}\n"
        f"Email:          {_one_line(body.email)}\n"
        f"Business:       {_one_line(body.business)}\n"
        f"Phone:          {_one_line(body.phone)}\n"
        f"Preferred time: {_one_line(body.preferred_time)}\n\n"
        f"Message:\n{(body.message or '-').strip()}\n\n"
        f"Sent {sent_at} from {ip}. Reply to this email to answer them directly.\n"
    )
    await email.send(
        to=settings.demo_inbox or settings.smtp_username,
        subject=f"CalMe demo request: {_one_line(body.business)}",
        body=text,
        reply_to=body.email,
    )
    logger.info("Demo request from %s (%s)", _one_line(body.business), _one_line(body.email))
    return DemoRequestOut()


@router.post("/session", response_model=SessionOut)
async def talk_to_demo_agent(request: Request, service: AgentServiceDep) -> SessionOut:
    """Start a live voice session with the landing page's demo agent."""
    state = request.app.state
    settings = state.settings
    if not settings.demo_agent_id:
        raise NotConfiguredError("The demo agent isn't set up yet. Set CALME_DEMO_AGENT_ID.")

    # every minute costs money, so cap each visitor and the whole site
    state.demo_session_ip_limit.check(
        client_ip(request), "You've tried the demo a few times already. Book a demo to hear more."
    )
    state.demo_session_global_limit.check(
        "all", "Lots of people are trying the demo right now. Please try again in a little while."
    )
    session = await service.start_session(UUID(settings.demo_agent_id))
    return SessionOut.model_validate(session)
