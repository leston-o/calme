import asyncio
import base64
import json
import logging
import time

from fastapi import WebSocket

from app.audio.codec import PHONE_RATE, pcm16_to_ulaw, pcm16_to_wav, ulaw_to_pcm16
from app.audio.vad import SpeechStarted, UtteranceDetector, UtteranceReady
from app.providers.base import LLMProvider, STTProvider, TTSProvider
from app.schemas.agent import Agent
from app.services.conversation import ConversationEngine

logger = logging.getLogger("calme.phone")

IDLE_PROMPT = "Are you still there?"
IDLE_GOODBYE = (
    "I haven't heard anything, so I'll end the call now. "
    "Please call back any time. Goodbye."
)
TIME_LIMIT_GOODBYE = (
    "I'm sorry, I have to end the call now. Thank you for calling. Goodbye."
)


class PhoneOutput:
    """Sends the agent's voice to Twilio as 8 kHz mu-law."""

    tts_format = "pcm"
    tts_sample_rate = PHONE_RATE

    def __init__(self, ws: WebSocket, stream_sid: str) -> None:
        self.ws = ws
        self.stream_sid = stream_sid
        # Twilio plays audio at normal speed but we send it faster than that, so
        # we track when everything we've sent will finish playing.
        self.playback_ends_at = 0.0

    async def user_text(self, text: str) -> None:
        logger.info("caller: %s", text)

    async def agent_audio(self, text: str, audio: bytes) -> None:
        logger.info("agent: %s", text)
        seconds = len(audio) / 2 / PHONE_RATE
        self.playback_ends_at = max(self.playback_ends_at, time.monotonic()) + seconds
        payload = base64.b64encode(pcm16_to_ulaw(audio)).decode()
        await self.ws.send_text(
            json.dumps(
                {
                    "event": "media",
                    "streamSid": self.stream_sid,
                    "media": {"payload": payload},
                }
            )
        )

    async def clear(self) -> None:
        """Tell Twilio to throw away audio it has buffered but not yet played."""
        self.playback_ends_at = time.monotonic()
        await self.ws.send_text(
            json.dumps({"event": "clear", "streamSid": self.stream_sid})
        )

    async def turn_done(self) -> None:
        pass

    async def error(self, message: str) -> None:
        logger.warning("turn error: %s", message)


class PhoneSession:
    """One phone call: Twilio audio in -> detect speech -> engine -> audio out.

    Also ends the call when the caller goes quiet or the call runs too long.
    """

    def __init__(
        self,
        ws: WebSocket,
        stream_sid: str,
        agent: Agent,
        stt: STTProvider,
        llm: LLMProvider,
        tts: TTSProvider,
        detector: UtteranceDetector | None = None,
        idle_timeout: float = 10.0,   # silence before "are you still there?"
        max_idle_prompts: int = 2,    # prompts before we hang up
        max_call_seconds: float = 900.0,
        poll_interval: float = 1.0,
    ) -> None:
        self.ws = ws
        self.output = PhoneOutput(ws, stream_sid)
        self.engine = ConversationEngine(agent, stt, llm, tts, self.output)
        self.detector = detector or UtteranceDetector(PHONE_RATE)
        self._idle_timeout = idle_timeout
        self._max_idle_prompts = max_idle_prompts
        self._max_call_seconds = max_call_seconds
        self._poll_interval = poll_interval
        self._last_caller_activity = time.monotonic()
        self._idle_prompts = 0

    async def run(self) -> None:
        await self.engine.start()  # greeting

        reader = asyncio.create_task(self._read_loop())
        watchdog = asyncio.create_task(self._watchdog())
        try:
            done, _pending = await asyncio.wait(
                {reader, watchdog}, return_when=asyncio.FIRST_COMPLETED
            )
            for task in done:
                task.result()  # re-raise e.g. WebSocketDisconnect
        finally:
            reader.cancel()
            watchdog.cancel()
            await asyncio.gather(reader, watchdog, return_exceptions=True)

    async def close(self) -> None:
        await self.engine.close()

    # ---- listening to the caller ----
    def _caller_is_active(self) -> None:
        self._last_caller_activity = time.monotonic()
        self._idle_prompts = 0

    async def _read_loop(self) -> None:
        while True:
            message = json.loads(await self.ws.receive_text())
            event = message.get("event")

            if event == "media":
                pcm = ulaw_to_pcm16(base64.b64decode(message["media"]["payload"]))
                for item in self.detector.feed(pcm):
                    if isinstance(item, SpeechStarted):
                        self._caller_is_active()
                        # barge-in: stop generating AND flush what Twilio buffered
                        await self.engine.interrupt()
                        await self.output.clear()
                    elif isinstance(item, UtteranceReady):
                        self._caller_is_active()
                        wav = pcm16_to_wav(item.pcm, PHONE_RATE)
                        await self.engine.handle_utterance(wav)
            elif event == "stop":
                return

    # ---- idle and time limit ----
    async def _watchdog(self) -> None:
        started = time.monotonic()
        while True:
            await asyncio.sleep(self._poll_interval)
            now = time.monotonic()

            if now - started >= self._max_call_seconds:
                logger.info("Call reached the %ss limit", self._max_call_seconds)
                await self._say_goodbye(TIME_LIMIT_GOODBYE)
                return

            if self.detector.speaking:
                self._caller_is_active()
                continue
            if self.engine.busy:
                continue  # the agent is thinking or talking

            quiet_since = max(self._last_caller_activity, self.output.playback_ends_at)
            if now - quiet_since < self._idle_timeout:
                continue

            if self._idle_prompts >= self._max_idle_prompts:
                logger.info("Caller silent for too long, ending the call")
                await self._say_goodbye(IDLE_GOODBYE)
                return

            self._idle_prompts += 1
            logger.info("Caller silent, prompt %d", self._idle_prompts)
            await self.engine.say(IDLE_PROMPT)

    async def _say_goodbye(self, text: str) -> None:
        await self.engine.say(text)
        await self.engine.wait_idle()
        remaining = self.output.playback_ends_at - time.monotonic()
        await asyncio.sleep(max(0.0, remaining) + 0.5)  # let it finish playing