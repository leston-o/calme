"""Public endpoints for the landing page: book a demo, and talk to the demo agent."""

import hmac
import logging
import secrets
from datetime import date, datetime, timezone
from html import escape
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, File, Form, Query, Request, UploadFile, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from app.api.deps import AgentServiceDep
from app.api.v1.agents import SessionOut
from app.core.errors import AppError, ConflictError, NotConfiguredError, NotFoundError
from app.core.rate_limit import client_ip
from app.repositories.demo_bookings import DemoBooking
from app.services.calendar_invite import calendar_invite
from app.services.demo_schedule import DemoSchedule
from app.services.demo_voices import CLONE_PASSAGE

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


class DemoSessionIn(BaseModel):
    voice_ref: str | None = Field(default=None, max_length=64)  # talk in the visitor's cloned voice


@router.post("/session", response_model=SessionOut)
async def talk_to_demo_agent(
    request: Request, service: AgentServiceDep, body: DemoSessionIn | None = None
) -> SessionOut:
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
    if body and body.voice_ref:
        voice = _demo_voices(request).get(body.voice_ref)
        session = await state.fish_agents.create_session(voice.fish_agent_id)
    else:
        session = await service.start_session(UUID(settings.demo_agent_id))
    return SessionOut.model_validate(session)


# ---------- the demo in the visitor's own voice ----------

MAX_CLONE_BYTES = 5 * 1024 * 1024
MIN_CLONE_SECONDS = 8


class CloneOut(BaseModel):
    voice_ref: str
    expires_at: datetime


class ClonePassageOut(BaseModel):
    passage: str
    minutes: int


def _demo_voices(request: Request):
    voices = getattr(request.app.state, "demo_voices", None)
    if voices is None or not request.app.state.settings.demo_agent_id:
        raise NotConfiguredError("Trying the demo in your own voice isn't available right now.")
    return voices


def _wav_seconds(data: bytes) -> float:
    """Length of a PCM WAV recording, or 0 if it isn't one."""
    if len(data) < 44 or data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        return 0.0
    byte_rate = int.from_bytes(data[28:32], "little")
    return (len(data) - 44) / byte_rate if byte_rate else 0.0


@router.get("/voice/passage", response_model=ClonePassageOut)
async def clone_passage(request: Request) -> ClonePassageOut:
    """What visitors read aloud, and how long their cloned voice is kept."""
    return ClonePassageOut(passage=CLONE_PASSAGE, minutes=request.app.state.settings.demo_voice_minutes)


@router.post("/voice", response_model=CloneOut, status_code=status.HTTP_201_CREATED)
async def clone_visitor_voice(
    request: Request,
    service: AgentServiceDep,
    audio: UploadFile = File(...),
    consent: bool = Form(...),
    website: str | None = Form(default=None),  # honeypot
) -> CloneOut:
    """Clone the visitor's voice for a short, temporary demo."""
    voices = _demo_voices(request)
    state = request.app.state
    if not consent:
        raise AppError("Please confirm this is your own voice and that you agree to the temporary copy.")
    if website:
        raise AppError("Something went wrong. Please try again.")

    data = await audio.read(MAX_CLONE_BYTES + 1)
    if len(data) > MAX_CLONE_BYTES:
        raise AppError("That recording is too long. Please keep it under 30 seconds.")
    seconds = _wav_seconds(data)
    if seconds < MIN_CLONE_SECONDS:
        raise AppError(f"Please record at least {MIN_CLONE_SECONDS} seconds of your voice.")

    state.demo_clone_ip_limit.check(client_ip(request), "You've already tried a voice today. Book a demo to hear more.")
    state.demo_clone_global_limit.check("all", "Lots of people are trying this right now. Please try again later.")

    demo_agent = await service.get(UUID(state.settings.demo_agent_id))
    voice = await voices.create(demo_agent, data, "voice.wav")
    return CloneOut(voice_ref=voice.ref, expires_at=datetime.fromtimestamp(voice.expires_at, timezone.utc))


@router.delete("/voice/{voice_ref}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_visitor_voice(voice_ref: str, request: Request) -> None:
    """Delete the visitor's cloned voice now, instead of waiting for it to expire."""
    voices = _demo_voices(request)
    try:
        voices.get(voice_ref)
    except NotFoundError:
        return
    await voices.delete(voice_ref)


# ---------- booking a demo slot, Calendly-style ----------


class SlotOut(BaseModel):
    start: datetime
    end: datetime
    status: Literal["free", "booked", "past"]


class DayOut(BaseModel):
    date: date
    slots: list[SlotOut]


class AvailabilityOut(BaseModel):
    timezone: str
    slot_minutes: int
    days: list[DayOut]


class BookingIn(BaseModel):
    start: datetime
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(max_length=200, pattern=EMAIL_PATTERN)
    business: str = Field(min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    message: str | None = Field(default=None, max_length=2000)
    website: str | None = Field(default=None, max_length=200)  # honeypot


class BookingOut(BaseModel):
    id: UUID
    start: datetime
    end: datetime
    when: str  # in the host's timezone, e.g. "Tuesday 18 November, 11:00–13:00 (EAT)"


@router.get("/availability", response_model=AvailabilityOut)
async def availability(request: Request) -> AvailabilityOut:
    """Your demo slots for the next few weeks: free, booked, or already past."""
    state = request.app.state
    schedule = DemoSchedule(state.settings)
    now = datetime.now(timezone.utc)
    start, end = schedule.window(now)
    booked = await state.demo_bookings.booked_starts(start, end)
    return AvailabilityOut(
        timezone=state.settings.demo_timezone,
        slot_minutes=state.settings.demo_slot_minutes,
        days=[
            DayOut(date=day, slots=[SlotOut(start=s.start, end=s.end, status=s.status) for s in slots])
            for day, slots in schedule.calendar(now, booked)
        ],
    )


@router.post("/bookings", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
async def book_slot(body: BookingIn, request: Request) -> BookingOut:
    """Book a demo slot, then email you (with a cancel link) and the visitor a calendar invite."""
    state = request.app.state
    settings = state.settings
    schedule = DemoSchedule(settings)
    now = datetime.now(timezone.utc)

    slot = schedule.find(body.start, now)
    if slot is None:
        raise ConflictError("That time isn't available any more. Please pick another.")
    start, end = slot
    when = schedule.describe(start, end)

    if body.website:  # a bot: pretend it worked, book nothing
        logger.info("Dropped a demo booking that filled the honeypot")
        return BookingOut(id=UUID(int=0), start=start, end=end, when=when)

    email = getattr(state, "email", None)
    if email is None:
        raise NotConfiguredError("Demo booking isn't set up yet. Set the CALME_SMTP_* settings.")
    state.demo_booking_limit.check(client_ip(request), "You've booked a few demos already. We'll be in touch soon.")

    booking = await state.demo_bookings.create(
        DemoBooking(
            starts_at=start,
            ends_at=end,
            name=_one_line(body.name),
            email=body.email.strip(),
            business=_one_line(body.business),
            phone=_one_line(body.phone) if body.phone else None,
            message=(body.message or "").strip() or None,
            cancel_token=secrets.token_urlsafe(24),
        )
    )

    host = settings.demo_inbox or settings.smtp_username
    cancel_url = (
        f"{settings.public_base_url.rstrip('/')}{settings.api_v1_prefix}/demo/bookings/{booking.id}/cancel?token={booking.cancel_token}"
        if settings.public_base_url
        else None
    )
    details = (
        f"Name:     {booking.name}\n"
        f"Email:    {booking.email}\n"
        f"Business: {booking.business}\n"
        f"Phone:    {booking.phone or '-'}\n\n"
        f"Message:\n{booking.message or '-'}\n"
    )
    try:
        await email.send(
            to=host,
            subject=f"Demo booked: {booking.business}, {when}",
            body=(
                f"{booking.name} booked a CalMe demo for {when}.\n\n{details}\n"
                + (f"Can't make it? Cancel and free the slot: {cancel_url}\n" if cancel_url else "")
                + "Reply to this email to reach them directly.\n"
            ),
            reply_to=booking.email,
            attachments=[("calme-demo.ics", "text/calendar", calendar_invite(
                booking.id, start, end, f"CalMe demo: {booking.business}", f"{booking.name} <{booking.email}>\n\n{details}"
            ))],
        )
    except AppError:
        await state.demo_bookings.set_status(booking.id, "cancelled")  # free the slot again
        raise

    # the visitor's confirmation; their booking stands even if this one fails
    try:
        await email.send(
            to=booking.email,
            subject=f"Your CalMe demo: {when}",
            body=(
                f"Hi {booking.name},\n\n"
                f"Your CalMe demo is booked for {when}. The invite is attached so you can add it to your calendar.\n\n"
                "We'll send the call details before then. Need to change the time? Just reply to this email.\n\n"
                "The CalMe team\n"
            ),
            reply_to=host,
            attachments=[("calme-demo.ics", "text/calendar", calendar_invite(
                booking.id, start, end, "CalMe demo", "Your CalMe demo. Reply to the confirmation email to change the time."
            ))],
        )
    except AppError:
        logger.warning("Couldn't send the visitor's confirmation for booking %s", booking.id)

    logger.info("Demo booked for %s by %s", when, booking.business)
    return BookingOut(id=booking.id, start=start, end=end, when=when)


def _page(title: str, text: str) -> HTMLResponse:
    return HTMLResponse(
        "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
        f"<title>{escape(title)}</title>"
        "<body style='font:16px system-ui;display:grid;place-items:center;min-height:90vh;color:#0f172a'>"
        f"<div style='max-width:28rem;text-align:center'><h1 style='font-weight:600'>{escape(title)}</h1><p>{escape(text)}</p></div>"
    )


@router.get("/bookings/{booking_id}/cancel", response_class=HTMLResponse, include_in_schema=False)
async def cancel_booking(booking_id: UUID, request: Request, token: str = Query(max_length=100)) -> HTMLResponse:
    """The link in your booking email: cancels the booking and frees the slot."""
    repo = request.app.state.demo_bookings
    booking = await repo.get(booking_id)
    if booking is None or not hmac.compare_digest(booking.cancel_token, token):
        return _page("Link not valid", "This cancel link doesn't match a booking.")
    if booking.status == "cancelled":
        return _page("Already cancelled", "This demo was already cancelled, and the slot is free.")
    await repo.set_status(booking.id, "cancelled")
    schedule = DemoSchedule(request.app.state.settings)
    when = schedule.describe(booking.starts_at, booking.ends_at)
    logger.info("Demo booking %s cancelled", booking.id)
    return _page("Demo cancelled", f"{booking.business} on {when} is cancelled. The slot is open for booking again. Let {booking.name} know at {booking.email}.")
