import asyncio
import contextlib
import logging
from typing import Protocol

from app.core.errors import AppError
from app.providers.base import ChatMessage, LLMProvider, STTProvider, TTSProvider
from app.schemas.agent import Agent
from app.services.prompt_builder import build_system_prompt
from app.services.sentences import SentenceBuffer, clean_for_speech

logger = logging.getLogger("calme.conversation")


class AudioOutput(Protocol):
    """Where the agent's voice goes: a browser, a phone line, a test script."""

    tts_format: str                 # what to ask the TTS provider for
    tts_sample_rate: int | None

    async def user_text(self, text: str) -> None: ...
    async def agent_audio(self, text: str, audio: bytes) -> None: ...
    async def turn_done(self) -> None: ...
    async def error(self, message: str) -> None: ...


class ConversationEngine:
    """The brain of one call. It knows nothing about browsers or phones.

    Input:  complete caller utterances (WAV bytes) and interrupts.
    Output: sentence-sized agent audio sent to an AudioOutput.
    """

    def __init__(
        self,
        agent: Agent,
        stt: STTProvider,
        llm: LLMProvider,
        tts: TTSProvider,
        out: AudioOutput,
    ) -> None:
        self.agent = agent
        self.stt = stt
        self.llm = llm
        self.tts = tts
        self.out = out
        self.system = build_system_prompt(agent)
        self.history: list[ChatMessage] = []
        self._turn: asyncio.Task | None = None

    async def start(self) -> None:
        """Speak the greeting."""
        try:
            await self._speak(self.agent.greeting)
            self.history.append(ChatMessage("assistant", self.agent.greeting))
        except AppError as exc:
            await self.out.error(exc.message)

    @property
    def busy(self) -> bool:
        """True while a reply is being prepared or spoken."""
        return self._turn is not None and not self._turn.done()

    async def say(self, text: str) -> None:
        """speak a fixed line(no LLM). The caller can interrupt it like any reply."""
        await self.interrupt()
        self._turn = asyncio.create_task(self._say(text))

    async def _say(self, text: str) -> None:
        try:
            await self._speak(text)
            self.history.append(ChatMessage("assistant", text))
        except asyncio.CancelledError:
            raise
        except AppError as exc:
            await self.out.error(exc.message)
        except Exception:
            logger.exception("Could not speak a fixed line")
            
    async def handle_utterance(self, audio: bytes) -> None:
        """The caller said something. Replaces any reply still in progress."""
        await self.interrupt()
        self._turn = asyncio.create_task(self._run_turn(audio))

    async def interrupt(self) -> None:
        """Stop the reply that is being generated or spoken."""
        task, self._turn = self._turn, None
        if task and not task.done():
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

    async def wait_idle(self) -> None:
        """Wait until the current reply has finished (handy for tests)."""
        task = self._turn
        if task:
            with contextlib.suppress(asyncio.CancelledError):
                await task

    async def close(self) -> None:
        await self.interrupt()

    async def _run_turn(self, audio: bytes) -> None:
        spoken: list[str] = []
        try:
            user_text = await self.stt.transcribe(audio, "en")
            if not user_text:
                return
            await self.out.user_text(user_text)
            self.history.append(ChatMessage("user", user_text))

            buffer = SentenceBuffer()
            async for token in self.llm.stream(self.system, self.history):
                for sentence in buffer.push(token):
                    await self._speak(sentence, spoken)
            tail = buffer.flush()
            if tail:
                await self._speak(tail, spoken)
            await self.out.turn_done()
        except asyncio.CancelledError:
            raise
        except AppError as exc:
            await self.out.error(exc.message)
        except Exception:
            logger.exception("Turn failed")
            await self.out.error("Something went wrong. Please try again.")
        finally:
            # keep only what was actually said, even if the turn was interrupted
            if spoken:
                self.history.append(ChatMessage("assistant", " ".join(spoken)))

    async def _speak(self, text: str, spoken: list[str] | None = None) -> None:
        clean = clean_for_speech(text)
        if not clean:
            return
        audio = await self.tts.synthesize(
            clean,
            None,  # agent voices are Live 3 voices; this pipeline uses Fish's default
            self.out.tts_format,
            self.out.tts_sample_rate,
        )
        await self.out.agent_audio(clean, audio)
        if spoken is not None:
            spoken.append(clean)