from uuid import UUID

from fastapi import APIRouter

from app.api.deps import AgentServiceDep, LLMDep
from app.providers.base import ChatMessage
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.prompt_builder import build_system_prompt

router = APIRouter(prefix="/agents", tags=["chat"])


@router.post("/{agent_id}/chat", response_model=ChatResponse)
async def chat_with_agent(
    agent_id: UUID,
    body: ChatRequest,
    service: AgentServiceDep,
    llm: LLMDep,
) -> ChatResponse:
    """Text-only test of the agent. The client sends the conversation so far."""
    agent = await service.get(agent_id)
    system = build_system_prompt(agent)
    history = [ChatMessage(role=t.role, content=t.content) for t in body.messages]
    reply = await llm.complete(system, history)
    return ChatResponse(reply=reply.strip())