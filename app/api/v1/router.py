from fastapi import APIRouter

from app.api.v1 import agents, assist, chat, demo, health, live, numbers, stt, telephony, tts, voices

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(tts.router)
api_router.include_router(stt.router)
api_router.include_router(voices.router)
api_router.include_router(agents.router)
api_router.include_router(chat.router)
api_router.include_router(assist.router)
api_router.include_router(live.router)
api_router.include_router(numbers.router)
api_router.include_router(telephony.router)
api_router.include_router(demo.router)