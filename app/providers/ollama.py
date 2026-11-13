import json
import logging
from collections.abc import AsyncIterator

import httpx

from app.core.errors import ProviderError
from app.providers.base import ChatMessage, LLMProvider

logger = logging.getLogger("calme.ollama")


class OllamaLLM(LLMProvider):
    def __init__(self, base_url: str, model: str) -> None:
        self._base_url = base_url
        self._model = model
        self._client = httpx.AsyncClient(
            base_url=base_url,
            timeout=httpx.Timeout(120.0, connect=5.0),  # first call loads the model
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def stream(
        self, system: str, messages: list[ChatMessage]
    ) -> AsyncIterator[str]:
        payload = {
            "model": self._model,
            "stream": True,
            "messages": [
                {"role": "system", "content": system},
                *[{"role": m.role, "content": m.content} for m in messages],
            ],
            "options": {"temperature": 0.6},
        }
        try:
            async with self._client.stream("POST", "/api/chat", json=payload) as resp:
                if resp.status_code != 200:
                    body = (await resp.aread()).decode(errors="replace")
                    raise ProviderError(f"Ollama error {resp.status_code}: {body}")
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    chunk = json.loads(line)
                    if "error" in chunk:
                        raise ProviderError(f"Ollama error: {chunk['error']}")
                    token = chunk.get("message", {}).get("content", "")
                    if token:
                        yield token
                    if chunk.get("done"):
                        break
        except httpx.ConnectError as exc:
            raise ProviderError(
                f"Cannot reach Ollama at {self._base_url}. Is it running?"
            ) from exc
        except httpx.HTTPError as exc:
            logger.exception("Ollama request failed")
            raise ProviderError(f"Ollama request failed: {exc}") from exc