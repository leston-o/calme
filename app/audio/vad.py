from collections import deque
from dataclasses import dataclass
from typing import Protocol


class VoiceActivity(Protocol):
    def is_speech(self, frame: bytes, sample_rate: int) -> bool: ...


@dataclass
class SpeechStarted:
    """The caller began talking (use it to interrupt the agent)."""


@dataclass
class UtteranceReady:
    """The caller finished a sentence. `pcm` is 16-bit mono audio."""

    pcm: bytes


Event = SpeechStarted | UtteranceReady


def default_vad(aggressiveness: int = 2) -> VoiceActivity:
    import webrtcvad  # provided by the webrtcvad-wheels package

    return webrtcvad.Vad(aggressiveness)


class UtteranceDetector:
    """Feed it raw PCM16 audio; it tells you when speech starts and ends."""

    def __init__(
        self,
        sample_rate: int = 8000,
        vad: VoiceActivity | None = None,
        frame_ms: int = 20,
        start_ms: int = 200,       # speech needed before we say "caller is talking"
        end_ms: int = 700,         # silence that ends a sentence
        pre_roll_ms: int = 300,    # audio kept from just before speech started
        min_speech_ms: int = 300,  # ignore shorter blips (coughs, clicks)
        max_utterance_ms: int = 20_000,
    ) -> None:
        self._rate = sample_rate
        self._vad = vad or default_vad()
        self._frame_ms = frame_ms
        self._frame_bytes = sample_rate * frame_ms // 1000 * 2
        self._start_frames = max(1, start_ms // frame_ms)
        self._end_frames = max(1, end_ms // frame_ms)
        self._min_speech_ms = min_speech_ms
        self._max_frames = max_utterance_ms // frame_ms

        self._pending = bytearray()
        self._pre_roll: deque[bytes] = deque(maxlen=max(1, pre_roll_ms // frame_ms))
        self._reset()

    def _reset(self) -> None:
        self._speaking = False
        self._voiced_run = 0
        self._silence_run = 0
        self._speech_frames = 0
        self._frames: list[bytes] = []
        self._pre_roll.clear()

    def feed(self, pcm: bytes) -> list[Event]:
        events: list[Event] = []
        self._pending += pcm
        while len(self._pending) >= self._frame_bytes:
            frame = bytes(self._pending[: self._frame_bytes])
            del self._pending[: self._frame_bytes]
            events.extend(self._process(frame))
        return events

    def _process(self, frame: bytes) -> list[Event]:
        is_speech = self._vad.is_speech(frame, self._rate)

        if not self._speaking:
            self._pre_roll.append(frame)
            self._voiced_run = self._voiced_run + 1 if is_speech else 0
            if self._voiced_run >= self._start_frames:
                self._speaking = True
                self._frames = list(self._pre_roll)
                self._speech_frames = self._voiced_run
                self._silence_run = 0
                return [SpeechStarted()]
            return []

        self._frames.append(frame)
        if is_speech:
            self._speech_frames += 1
            self._silence_run = 0
        else:
            self._silence_run += 1

        if self._silence_run >= self._end_frames or len(self._frames) >= self._max_frames:
            return self._finish()
        return []

    def _finish(self) -> list[Event]:
        long_enough = self._speech_frames * self._frame_ms >= self._min_speech_ms
        pcm = b"".join(self._frames)
        self._reset()
        return [UtteranceReady(pcm)] if long_enough else []

    @property
    def speaking(self) -> bool:
        """True while the caller is in the middle of a sentence."""
        return self._speaking