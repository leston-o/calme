import logging

from fishaudio import AsyncFishAudio

from app.core.errors import ProviderError
from app.providers.base import STTProvider, TTSProvider
import httpx

logger = logging.getLogger("calme.fish")


class FishAudioTTS(TTSProvider):
    def __init__(self, api_key: str, model: str = "s2-pro") -> None:
        self._client = httpx.AsyncClient(
            base_url="https://api.fish.audio",
            headers={"Authorization": f"Bearer {api_key}", "model": model},
            timeout=httpx.Timeout(60.0, connect=10.0),
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def synthesize(
        self,
        text: str,
        voice_id: str | None = None,
        audio_format: str = "mp3",
        sample_rate: int | None = None,
    ) -> bytes:
        payload: dict = {"text": text, "format": audio_format}
        if voice_id:
            payload["reference_id"] = voice_id  # a voice/model ID from Fish Audio
        if sample_rate:
            payload["sample_rate"] = sample_rate
        try:
            resp = await self._client.post("/v1/tts", json=payload)
        except httpx.HTTPError as exc:
            logger.exception("Fish Audio TTS request failed")
            raise ProviderError(f"Fish Audio request failed: {exc}") from exc
        if resp.status_code != 200:
            raise ProviderError(
                f"Fish Audio error {resp.status_code}: {resp.text[:300]}"
            )
        return resp.content


class FishAudioSTT(STTProvider):
    def __init__(self, api_key: str) -> None:
        self._client = AsyncFishAudio(api_key=api_key)

    async def transcribe(self, audio: bytes, language: str | None = None) -> str:
        kwargs: dict = {"audio": audio, "include_timestamps": False}
        if language:
            kwargs["language"] = language
        try:
            result = await self._client.asr.transcribe(**kwargs)
        except Exception as exc:
            logger.exception("Fish Audio ASR request failed")
            raise ProviderError(f"Fish Audio transcription failed: {exc}") from exc
        return (result.text or "").strip()
