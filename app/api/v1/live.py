from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.live_session import LiveSession

router = APIRouter(tags=["live"])


@router.websocket("/agents/{agent_id}/live")
async def live_conversation(ws: WebSocket, agent_id: UUID) -> None:
    await ws.accept()
    state = ws.app.state

    agent = await state.agent_repo.get(agent_id)
    if agent is None:
        await ws.close(code=4404, reason="Agent not found")
        return
    if state.stt is None or state.tts is None:
        await ws.close(code=4503, reason="Set CALME_FISH_API_KEY")
        return

    session = LiveSession(ws, agent, state.stt, state.llm, state.tts)
    try:
        await session.run()
    except WebSocketDisconnect:
        pass