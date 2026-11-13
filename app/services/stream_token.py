import hashlib
import hmac
import time


def _sign(secret: str, message: str) -> str:
    return hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()


def make_token(secret: str, agent_id: str, call_sid: str, ttl_seconds: int = 300) -> str:
    """A short-lived proof that our webhook (not a stranger) approved this call."""
    expires = int(time.time()) + ttl_seconds
    return f"{expires}.{_sign(secret, f'{agent_id}.{call_sid}.{expires}')}"


def verify_token(secret: str, agent_id: str, call_sid: str, token: str) -> bool:
    try:
        expires_text, signature = token.split(".", 1)
        expires = int(expires_text)
    except ValueError:
        return False
    if expires < time.time():
        return False
    expected = _sign(secret, f"{agent_id}.{call_sid}.{expires}")
    return hmac.compare_digest(signature, expected)