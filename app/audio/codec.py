import io
import wave

import numpy as np

PHONE_RATE = 8000
ULAW_FRAME_BYTES = 160  # 20 ms of 8 kHz mu-law audio

_BIAS = 0x84
_CLIP = 32635


def _build_decode_table() -> np.ndarray:
    table = np.zeros(256, dtype=np.int16)
    for i in range(256):
        u = ~i & 0xFF
        sign = u & 0x80
        exponent = (u >> 4) & 0x07
        mantissa = u & 0x0F
        sample = (((mantissa << 3) + _BIAS) << exponent) - _BIAS
        table[i] = -sample if sign else sample
    return table


def _build_exponent_table() -> np.ndarray:
    table = np.zeros(256, dtype=np.int32)
    for i in range(1, 256):
        table[i] = i.bit_length() - 1
    return table


_DECODE = _build_decode_table()
_EXPONENT = _build_exponent_table()


def ulaw_to_pcm16(data: bytes) -> bytes:
    """G.711 mu-law bytes -> 16-bit little-endian PCM bytes."""
    idx = np.frombuffer(data, dtype=np.uint8)
    return _DECODE[idx].tobytes()


def pcm16_to_ulaw(pcm: bytes) -> bytes:
    """16-bit little-endian PCM bytes -> G.711 mu-law bytes."""
    pcm = pcm[: len(pcm) // 2 * 2]
    samples = np.frombuffer(pcm, dtype=np.int16).astype(np.int32)
    sign = np.where(samples < 0, 0x80, 0)
    magnitude = np.minimum(np.abs(samples), _CLIP) + _BIAS
    exponent = _EXPONENT[magnitude >> 7]
    mantissa = (magnitude >> (exponent + 3)) & 0x0F
    ulaw = ~(sign | (exponent << 4) | mantissa) & 0xFF
    return ulaw.astype(np.uint8).tobytes()


def resample_pcm16(pcm: bytes, src_rate: int, dst_rate: int) -> bytes:
    """Simple linear resampler. Fine for phone audio and tests."""
    if src_rate == dst_rate or not pcm:
        return pcm
    x = np.frombuffer(pcm[: len(pcm) // 2 * 2], dtype=np.int16).astype(np.float32)
    if dst_rate < src_rate:  # crude low-pass to reduce aliasing when downsampling
        k = max(1, int(round(src_rate / dst_rate)))
        x = np.convolve(x, np.ones(k, dtype=np.float32) / k, mode="same")
    n_out = int(len(x) * dst_rate / src_rate)
    if n_out == 0:
        return b""
    positions = np.linspace(0, len(x) - 1, n_out)
    y = np.interp(positions, np.arange(len(x)), x)
    return np.clip(y, -32768, 32767).astype(np.int16).tobytes()


def pcm16_to_wav(pcm: bytes, sample_rate: int) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm)
    return buf.getvalue()


def read_wav_mono16(data: bytes) -> tuple[bytes, int]:
    """Read a 16-bit WAV file. Returns (mono PCM bytes, sample rate)."""
    with wave.open(io.BytesIO(data), "rb") as w:
        if w.getsampwidth() != 2:
            raise ValueError("Only 16-bit WAV files are supported")
        rate, channels = w.getframerate(), w.getnchannels()
        frames = w.readframes(w.getnframes())
    samples = np.frombuffer(frames, dtype=np.int16)
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1).astype(np.int16)
    return samples.tobytes(), rate


def ulaw_to_frames(ulaw: bytes, frame_bytes: int = ULAW_FRAME_BYTES) -> list[bytes]:
    """Split mu-law audio into fixed-size frames (last one padded with silence)."""
    frames = []
    for i in range(0, len(ulaw), frame_bytes):
        frame = ulaw[i : i + frame_bytes]
        if len(frame) < frame_bytes:
            frame += b"\xff" * (frame_bytes - len(frame))
        frames.append(frame)
    return frames