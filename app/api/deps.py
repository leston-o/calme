from typing import Annotated

from fastapi import Depends, Request

from app.core.errors import NotConfiguredError
from app.providers.base import TTSProvider, LLMProvider, STTProvider
from app.repositories.base import AgentRepository
from app.schemas.agent import Agent
from app.services.agent_service import AgentService
from app.services.fish_agent_sync import FishAgentSync
from app.services.number_service import NumberService, PhoneLine

def get_tts_provider(request: Request) -> TTSProvider:
    tts = getattr(request.app.state, "tts", None)
    if tts is None:
        raise NotConfiguredError("TTS is not configured. Set CALME_FISH_API_KEY.")
    return tts


def get_stt_provider(request: Request) -> STTProvider:
    stt = getattr(request.app.state, "stt", None)
    if stt is None:
        raise NotConfiguredError("STT is not configured. Set CALME_FISH_API_KEY")
    return stt


def get_llm_provider(request: Request) -> LLMProvider:
    llm = getattr(request.app.state, "llm", None)
    if llm is None:
        raise NotConfiguredError("LLM is not configured.")
    return llm


def get_agent_repository(request: Request) -> AgentRepository:
    return request.app.state.agent_repo


def get_fish_agent_sync(
    request: Request,
    repo: Annotated[AgentRepository, Depends(get_agent_repository)],
) -> FishAgentSync | None:
    state = request.app.state
    fish_agents = getattr(state, "fish_agents", None)
    if fish_agents is None:
        return None
    return FishAgentSync(fish_agents, repo, state.settings)


def get_agent_service(
    repo: Annotated[AgentRepository, Depends(get_agent_repository)],
    fish: Annotated[FishAgentSync | None, Depends(get_fish_agent_sync)],
) -> AgentService:
    return AgentService(repo, fish)


def get_number_service(
    request: Request,
    repo: Annotated[AgentRepository, Depends(get_agent_repository)],
    fish: Annotated[FishAgentSync | None, Depends(get_fish_agent_sync)],
) -> NumberService:
    state = request.app.state
    settings = state.settings
    lines: dict[str, PhoneLine] = {}

    fish_telephony = getattr(state, "fish_telephony", None)
    if fish_telephony is not None and fish is not None:

        async def fish_route(agent: Agent) -> str:
            return (await fish.ensure(agent)).fish_agent_id

        lines["fish"] = PhoneLine(fish_telephony, fish_route)

    twilio = getattr(state, "telephony", None)
    if twilio is not None and settings.public_base_url:
        voice_url = (
            f"{settings.public_base_url.rstrip('/')}{settings.api_v1_prefix}/telephony/twilio/voice"
        )

        async def twilio_route(_agent: Agent) -> str:
            return voice_url

        lines["twilio"] = PhoneLine(twilio, twilio_route)

    if not lines:
        raise NotConfiguredError(
            "Phone numbers are not configured. Set CALME_FISH_API_KEY, "
            "or the Twilio keys and CALME_PUBLIC_BASE_URL."
        )
    return NumberService(repo, lines, "fish" if "fish" in lines else "twilio")


TTSDep = Annotated[TTSProvider, Depends(get_tts_provider)]
STTDep = Annotated[STTProvider, Depends(get_stt_provider)]
LLMDep = Annotated[LLMProvider, Depends(get_llm_provider)]
AgentServiceDep = Annotated[AgentService, Depends(get_agent_service)]
NumberServiceDep = Annotated[NumberService, Depends(get_number_service)]
