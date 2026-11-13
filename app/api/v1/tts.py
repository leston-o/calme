from fastapi import APIRouter, Response
from pydantic import BaseModel, Field

from app.api.deps import TTSDep

router = APIRouter(prefix="/tts", tags=["tts"])


class TTSTestRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    voice_id: str | None = None


@router.post("/test")
async def test_tts(body: TTSTestRequest, tts: TTSDep) -> Response:
    audio = await tts.synthesize(body.text, body.voice_id)
    return Response(content=audio, media_type="audio/mpeg")