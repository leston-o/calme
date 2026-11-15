import asyncio
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


class FishVoiceCloner:
    """Creates and deletes private cloned voices (Fish Audio "models")."""

    def __init__(self, api_key: str) -> None:
        self._client = httpx.AsyncClient(
            base_url="https://api.fish.audio",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=httpx.Timeout(60.0, connect=10.0),
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def create(self, title: str, audio: bytes, filename: str, transcript: str | None = None) -> str:
        """Clone a voice from one recording. Returns its id once it's usable."""
        data = {"type": "tts", "title": title, "train_mode": "fast", "visibility": "private"}
        if transcript:
            data["texts"] = transcript
        try:
            resp = await self._client.post("/model", data=data, files={"voices": (filename, audio)})
        except httpx.HTTPError as exc:
            logger.exception("Fish Audio voice clone request failed")
            raise ProviderError("We couldn't create your voice just now. Please try again.") from exc
        if resp.status_code >= 400:
            logger.warning("Fish Audio voice clone failed %s: %s", resp.status_code, resp.text[:300])
            raise ProviderError("We couldn't create your voice from that recording. Please try again.")
        model = resp.json()
        voice_id = model["_id"]
        state = model.get("state")
        # fast clones are usually ready at once; wait briefly if not
        for _ in range(10):
            if state == "trained":
                return voice_id
            if state == "failed":
                break
            await asyncio.sleep(1.5)
            state = (await self._client.get(f"/model/{voice_id}")).json().get("state")
        await self.delete(voice_id)
        raise ProviderError("We couldn't create your voice from that recording. Please try again.")

    async def delete(self, voice_id: str) -> None:
        try:
            resp = await self._client.delete(f"/model/{voice_id}")
            if resp.status_code >= 400 and resp.status_code != 404:
                logger.warning("Deleting cloned voice %s failed: %s", voice_id, resp.status_code)
        except httpx.HTTPError:
            logger.exception("Deleting cloned voice %s failed", voice_id)
