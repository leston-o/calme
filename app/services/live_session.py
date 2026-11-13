import contextlib
import json

from fastapi import WebSocket

from app.providers.base import LLMProvider, STTProvider, TTSProvider
from app.schemas.agent import Agent
from app.services.conversation import ConversationEngine


class BrowserOutput:
    """Sends the agent's voice to the browser as mp3 over the WebSocket."""

    tts_format = "mp3"
    tts_sample_rate = None

    def __init__(self, ws: WebSocket) -> None:
        self.ws = ws

    async def user_text(self, text: str) -> None:
        await self.ws.send_json({"type": "user_text", "text": text})

    async def agent_audio(self, text: str, audio: bytes) -> None:
        await self.ws.send_json({"type": "agent_text", "text": text})
        await self.ws.send_bytes(audio)

    async def turn_done(self) -> None:
        await self.ws.send_json({"type": "turn_done"})

    async def error(self, message: str) -> None:
        with contextlib.suppress(Exception):
            await self.ws.send_json({"type": "error", "message": message})


class LiveSession:
    def __init__(
        self,
        ws: WebSocket,
        agent: Agent,
        stt: STTProvider,
        llm: LLMProvider,
        tts: TTSProvider,
    ) -> None:
        self.ws = ws
        self.agent = agent
        self.engine = ConversationEngine(agent, stt, llm, tts, BrowserOutput(ws))

    async def run(self) -> None:
        await self.ws.send_json({"type": "ready", "agent": self.agent.name})
        await self.engine.start()
        try:
            while True:
                message = await self.ws.receive()
                if message["type"] == "websocket.disconnect":
                    break
                audio = message.get("bytes")
                text = message.get("text")
                if audio:
                    await self.engine.handle_utterance(audio)
                elif text:
                    try:
                        data = json.loads(text)
                    except json.JSONDecodeError:
                        continue
                    if data.get("type") == "interrupt":
                        await self.engine.interrupt()
        finally:
            await self.engine.close()