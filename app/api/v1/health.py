from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness: the process is up."""
    return {"status": "ok"}


@router.get("/status")
async def status(request: Request) -> dict:
    """Which providers are configured (no external calls; safe to poll)."""
    state = request.app.state
    settings = state.settings
    fish_agents = getattr(state, "fish_agents", None) is not None
    if fish_agents:
        llm_model = settings.fish_agent_llm_custom_model or settings.fish_agent_llm_model
        llm = {"configured": True, "provider": "fish", "model": llm_model}
    else:
        llm = {"configured": state.llm is not None, "provider": "ollama", "model": settings.ollama_model}
    return {
        "app": settings.app_name,
        "environment": settings.environment,
        "database": "postgres" if state.engine is not None else "in-memory",
        "llm": llm,
        "voice": {"configured": state.tts is not None, "model": settings.fish_tts_model},
        "telephony": {
            "configured": fish_agents or state.telephony is not None,
            "provider": "fish" if fish_agents else "twilio",
            # Fish numbers ring Fish directly; only Twilio needs our public URL
            "webhook_ready": fish_agents or settings.public_base_url.startswith("https://"),
        },
    }


@router.get("/ready")
async def ready(request: Request):
    """Readiness: the database answers."""
    engine = getattr(request.app.state, "engine", None)
    if engine is None:
        return {"status": "ok", "database": "in-memory"}
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "database": str(exc)},
        )
    return {"status": "ok", "database": "connected"}