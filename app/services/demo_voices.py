"""Temporary cloned voices for the landing-page demo.

A visitor records their voice; we clone it on Fish Audio and make a short-lived copy of
the demo agent that speaks in it. Both are deleted when they expire or when the visitor
asks. Everything lives in memory, so a restart forgets them; the sweep on startup and
the provider-side cleanup keep that from leaving voices behind for long.
"""

import asyncio
import logging
import secrets
import time
from dataclasses import dataclass

from app.core.config import Settings
from app.core.errors import NotFoundError
from app.providers.fish_agent import FishAgents
from app.providers.fish_audio import FishVoiceCloner
from app.schemas.agent import Agent
from app.services.fish_agent_sync import build_fish_agent_config

logger = logging.getLogger("calme.demo_voices")

# What visitors read aloud. Also sent as the transcript, which helps the clone.
CLONE_PASSAGE = (
    "Hello, and thanks for calling. I'm happy to help with opening hours, prices or bookings. "
    "If I can't answer straight away, I'll take a message and make sure someone gets back to you today."
)


@dataclass
class DemoVoice:
    ref: str  # what the browser holds; never the provider ids
    voice_id: str
    fish_agent_id: str
    expires_at: float  # epoch seconds


class DemoVoices:
    def __init__(self, cloner: FishVoiceCloner, agents: FishAgents, settings: Settings) -> None:
        self._cloner = cloner
        self._agents = agents
        self._settings = settings
        self._voices: dict[str, DemoVoice] = {}
        self._lock = asyncio.Lock()

    @property
    def lifetime(self) -> int:
        return self._settings.demo_voice_minutes * 60

    async def create(self, demo_agent: Agent, audio: bytes, filename: str) -> DemoVoice:
        voice_id = await self._cloner.create(
            f"CalMe demo visitor {secrets.token_hex(3)}", audio, filename, CLONE_PASSAGE
        )
        try:
            config = build_fish_agent_config(demo_agent, self._settings)
            # setting voice_id (and no live3_voice) makes Live 3 speak in the clone
            config["voice"] = {"engine": "live3", "voice_id": voice_id, "live3_prompt": "P2", "speaking_language": "en"}
            config["prompt"]["first_message"] = (
                f"Hi, it's {demo_agent.name}, and yes, that's your voice! "
                "This is how your own call agent could sound. Ask me anything."
            )
            fish_agent_id = await self._agents.create_agent(
                f"{demo_agent.name} (visitor voice)"[:120], "Temporary landing page demo", config
            )
            try:
                await self._agents.publish(fish_agent_id, "Visitor voice demo")
            except Exception:
                await self._agents.delete_agent(fish_agent_id)
                raise
        except Exception:
            await self._cloner.delete(voice_id)
            raise

        voice = DemoVoice(secrets.token_urlsafe(18), voice_id, fish_agent_id, time.time() + self.lifetime)
        async with self._lock:
            self._voices[voice.ref] = voice
        logger.info("Created a demo voice (expires in %s min)", self._settings.demo_voice_minutes)
        return voice

    def get(self, ref: str) -> DemoVoice:
        voice = self._voices.get(ref)
        if voice is None or voice.expires_at < time.time():
            raise NotFoundError("Your voice has expired. Record it again to keep going.")
        return voice

    async def delete(self, ref: str) -> None:
        async with self._lock:
            voice = self._voices.pop(ref, None)
        if voice:
            await self._remove(voice)

    async def sweep(self) -> None:
        """Delete every voice past its expiry."""
        now = time.time()
        async with self._lock:
            expired = [v for v in self._voices.values() if v.expires_at < now]
            for v in expired:
                self._voices.pop(v.ref, None)
        for v in expired:
            await self._remove(v)

    async def delete_all(self) -> None:
        async with self._lock:
            voices = list(self._voices.values())
            self._voices.clear()
        for v in voices:
            await self._remove(v)

    async def _remove(self, voice: DemoVoice) -> None:
        try:
            await self._agents.delete_agent(voice.fish_agent_id)
        except Exception:
            logger.warning("Couldn't delete temporary demo agent %s", voice.fish_agent_id)
        await self._cloner.delete(voice.voice_id)
        logger.info("Deleted a demo voice")
