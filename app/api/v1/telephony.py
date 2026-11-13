import asyncio
import json
import logging
from uuid import UUID
import contextlib

from fastapi import APIRouter, Request, Response, WebSocket, WebSocketDisconnect
from twilio.request_validator import RequestValidator
from twilio.twiml.voice_response import Connect, VoiceResponse

from app.services.phone_session import PhoneSession
from app.services.stream_token import make_token, verify_token

logger = logging.getLogger("calme.telephony")

router = APIRouter(prefix="/telephony/twilio", tags=["telephony"])


def _twiml(response: VoiceResponse) -> Response:
    return Response(content=str(response), media_type="application/xml")


def _polite_hangup(message: str) -> Response:
    response = VoiceResponse()
    response.say(message)
    response.hangup()
    return _twiml(response)


@router.post("/voice")
async def incoming_call(request: Request) -> Response:
    """Twilio calls this when someone dials one of our numbers."""
    state = request.app.state
    settings = state.settings
    base_url = settings.public_base_url.rstrip("/")
    if not settings.twilio_auth_token or not base_url.startswith("https://"):
        logger.error("Set CALME_TWILIO_AUTH_TOKEN and an https CALME_PUBLIC_BASE_URL")
        return _polite_hangup("Sorry, this service is not available right now.")

    form = {k: str(v) for k, v in (await request.form()).items()}
    signature = request.headers.get("X-Twilio-Signature", "")
    url = base_url + request.url.path
    if request.url.query:
        url += f"?{request.url.query}"
    if not RequestValidator(settings.twilio_auth_token).validate(url, form, signature):
        logger.warning("Rejected webhook with a bad Twilio signature (url used: %s)", url)
        return Response(status_code=403)

    called = form.get("To", "")
    call_sid = form.get("CallSid", "")
    agent = await state.agent_repo.get_by_phone_number(called)
    if agent is None:
        logger.warning("Call to %s but no agent owns that number", called)
        return _polite_hangup("Sorry, this number is not in service.")

    ws_url = (
        base_url.replace("https://", "wss://", 1)
        + f"{settings.api_v1_prefix}/telephony/twilio/stream"
    )
    token = make_token(settings.twilio_auth_token, str(agent.id), call_sid)

    response = VoiceResponse()
    connect = Connect()
    stream = connect.stream(url=ws_url)
    stream.parameter(name="agent_id", value=str(agent.id))
    stream.parameter(name="token", value=token)
    response.append(connect)
    response.hangup()   

    logger.info("Incoming call %s to %s -> agent %s", call_sid, called, agent.name)
    return _twiml(response)


async def _wait_for_start(ws: WebSocket) -> dict:
    while True:
        message = json.loads(await ws.receive_text())
        if message.get("event") == "start":
            return message


@router.websocket("/stream")
async def media_stream(ws: WebSocket) -> None:
    """Twilio streams the call's audio here."""
    await ws.accept()
    state = ws.app.state
    settings = state.settings

    if not settings.twilio_auth_token:
        await ws.close(code=4503)
        return

    try:
        start = (await asyncio.wait_for(_wait_for_start(ws), timeout=10))["start"]
    except (asyncio.TimeoutError, WebSocketDisconnect, ValueError, KeyError):
        await ws.close(code=4400)
        return

    params = start.get("customParameters", {})
    agent_id = params.get("agent_id", "")
    call_sid = start.get("callSid", "")
    if not verify_token(
        settings.twilio_auth_token, agent_id, call_sid, params.get("token", "")
    ):
        logger.warning("Rejected media stream with an invalid token")
        await ws.close(code=4401)
        return

    agent = await state.agent_repo.get(UUID(agent_id))
    if agent is None or state.stt is None or state.tts is None:
        await ws.close(code=4503)
        return

    logger.info("Call %s connected to agent %s", call_sid, agent.name)
    session = PhoneSession(
        ws,
        start["streamSid"],
        agent,
        state.stt,
        state.llm,
        state.tts,
        idle_timeout=settings.idle_timeout_seconds,
        max_idle_prompts=settings.idle_max_prompts,
        max_call_seconds=settings.max_call_seconds,
    )
    try:
        await session.run()
    except WebSocketDisconnect:
        pass
    finally:
        await session.close()
        with contextlib.suppress(Exception):
            await ws.close()  # this is what makes Twilio move on and hang up
        logger.info("Call %s ended", call_sid)