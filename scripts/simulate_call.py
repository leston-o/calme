"""Simulate a phone call from a WAV file.

Usage (from the project root):
    python -m scripts.simulate_call <agent_id> question.wav [reply.wav]
"""
import asyncio
import sys
from uuid import UUID

from app.audio.codec import (
    PHONE_RATE,
    pcm16_to_ulaw,
    pcm16_to_wav,
    read_wav_mono16,
    resample_pcm16,
    ulaw_to_frames,
    ulaw_to_pcm16,
)
from app.audio.vad import SpeechStarted, UtteranceDetector, UtteranceReady
from app.core.config import get_settings
from app.db.session import create_engine, create_session_factory
from app.providers.fish_audio import FishAudioSTT, FishAudioTTS
from app.providers.ollama import OllamaLLM
from app.repositories.postgres import PostgresAgentRepository
from app.services.conversation import ConversationEngine


class SimulatedPhoneOutput:
    """Pretends to be the phone line: agent audio goes out as 8 kHz mu-law."""

    tts_format = "pcm"
    tts_sample_rate = PHONE_RATE

    def __init__(self) -> None:
        self.heard = bytearray()  # what the caller would hear, as PCM16

    async def user_text(self, text: str) -> None:
        print(f"  caller said: {text}")

    async def agent_audio(self, text: str, audio: bytes) -> None:
        print(f"  agent says:  {text}")
        for frame in ulaw_to_frames(pcm16_to_ulaw(audio)):  # what we'd send to Twilio
            self.heard += ulaw_to_pcm16(frame)               # what the caller hears

    async def turn_done(self) -> None:
        pass

    async def error(self, message: str) -> None:
        print(f"  ERROR: {message}")


async def main(agent_id: str, wav_path: str, out_path: str) -> None:
    settings = get_settings()
    if not settings.database_url or not settings.fish_api_key:
        raise SystemExit("Set CALME_DATABASE_URL and CALME_FISH_API_KEY in .env")

    db = create_engine(settings.database_url)
    repo = PostgresAgentRepository(create_session_factory(db))
    agent = await repo.get(UUID(agent_id))
    if agent is None:
        raise SystemExit(f"Agent {agent_id} not found")

    llm = OllamaLLM(settings.ollama_base_url, settings.ollama_model)
    out = SimulatedPhoneOutput()
    engine = ConversationEngine(
        agent,
        FishAudioSTT(settings.fish_api_key),
        llm,
        FishAudioTTS(settings.fish_api_key),
        out,
    )
    detector = UtteranceDetector(PHONE_RATE)

    with open(wav_path, "rb") as f:
        pcm, rate = read_wav_mono16(f.read())
    pcm = resample_pcm16(pcm, rate, PHONE_RATE)
    pcm += bytes(PHONE_RATE * 2 * 2)  # 2 s of silence so the sentence can end
    line = ulaw_to_pcm16(pcm16_to_ulaw(pcm))  # what survives the phone line

    print("Call connected. Agent greets:")
    await engine.start()

    frame_bytes = PHONE_RATE * 20 // 1000 * 2  # one 20 ms frame
    for i in range(0, len(line), frame_bytes):
        for event in detector.feed(line[i : i + frame_bytes]):
            if isinstance(event, SpeechStarted):
                print("  [speech started]")
            elif isinstance(event, UtteranceReady):
                print(f"  [utterance: {len(event.pcm) / 2 / PHONE_RATE:.1f}s]")
                await engine.handle_utterance(pcm16_to_wav(event.pcm, PHONE_RATE))
                await engine.wait_idle()

    await engine.close()
    await llm.aclose()
    await db.dispose()

    with open(out_path, "wb") as f:
        f.write(pcm16_to_wav(bytes(out.heard), PHONE_RATE))
    print(f"\nSaved what the caller would hear to {out_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit("Usage: python -m scripts.simulate_call <agent_id> question.wav [reply.wav]")
    asyncio.run(main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "phone_reply.wav"))