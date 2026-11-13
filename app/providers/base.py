from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass


class TTSProvider(ABC):
    """Anything that can turn text into speech."""

    @abstractmethod
    async def synthesize(
        self,
        text: str,
        voice_id: str | None = None,
        audio_format: str = "mp3",
        sample_rate: int | None = None
    ) -> bytes: ...


class STTProvider(ABC):
    """Anything that can turn recorded speech into text."""

    @abstractmethod
    async def transcribe(self, audio: bytes, language: str | None = None) -> str: ...


@dataclass
class ChatMessage:
    role: str  # "user" or "assistant"
    content: str


class LLMProvider(ABC):
    """Anything that can generate a reply from a conversation."""

    @abstractmethod
    def stream(self, system: str, messages: list[ChatMessage]) -> AsyncIterator[str]:
        """Yield the reply piece by piece as it is generated."""

    async def complete(self, system: str, messages: list[ChatMessage]) -> str:
        """Collect the whole reply into one string."""
        parts: list[str] = []
        async for token in self.stream(system, messages):
            parts.append(token)
        return "".join(parts)


@dataclass
class AvailableNumber:
    phone_number: str
    friendly_name: str
    locality: str | None
    region: str | None
    country: str
    number_type: str
    address_required: bool


@dataclass
class PurchasedNumber:
    sid: str
    phone_number: str


class TelephonyProvider(ABC):
    """Anything that can sell us phone numbers and send their calls somewhere.

    A route is where calls go: a webhook URL for Twilio, an agent ID for Fish Audio.
    """

    @abstractmethod
    async def search_numbers(
        self,
        country: str,
        number_type: str,
        contains: str | None = None,
        area_code: str | None = None,
        limit: int = 20,
    ) -> list[AvailableNumber]: ...

    @abstractmethod
    async def buy_number(self, phone_number: str, route: str) -> PurchasedNumber: ...

    @abstractmethod
    async def update_route(self, sid: str, route: str) -> None: ...

    @abstractmethod
    async def release_number(self, sid: str) -> None: ...