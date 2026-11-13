import time
from collections import defaultdict, deque

from fastapi import Request

from app.core.errors import AppError


class TooManyRequestsError(AppError):
    status_code = 429
    code = "rate_limited"


class RateLimiter:
    """In-memory sliding-window limit. Per process, so it resets on restart."""

    def __init__(self, limit: int, window_seconds: float) -> None:
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, message: str) -> None:
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            raise TooManyRequestsError(message)
        hits.append(now)


def client_ip(request: Request) -> str:
    # Render and Vercel put the visitor's address first in X-Forwarded-For
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
