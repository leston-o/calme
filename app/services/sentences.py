import re

# a sentence ends at . ! or ? followed by whitespace
_END = re.compile(r"([.!?]+[\"')\]]*)(\s+)")


class SentenceBuffer:
    """Collects streamed LLM tokens and releases complete sentences."""

    def __init__(self) -> None:
        self._buf = ""

    def push(self, token: str) -> list[str]:
        self._buf += token
        sentences: list[str] = []
        while (match := _END.search(self._buf)):
            sentence = self._buf[: match.end(1)].strip()
            self._buf = self._buf[match.end():]
            if sentence:
                sentences.append(sentence)
        return sentences

    def flush(self) -> str | None:
        rest = self._buf.strip()
        self._buf = ""
        return rest or None


def clean_for_speech(text: str) -> str:
    """Remove characters that sound wrong when spoken."""
    return re.sub(r"[*_#`]", "", text).strip()