from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel

from app.api.deps import STTDep
from app.core.errors import AppError

router = APIRouter(prefix="/stt", tags=["stt"])

MAX_AUDIO_BYTES = 10 * 1024 * 1024  # 10 MB is plenty for one utterance


class TranscriptionResponse(BaseModel):
    text: str


@router.post("/test", response_model=TranscriptionResponse)
async def test_stt(
    stt: STTDep,
    file: UploadFile = File(...),
    language: str | None = Form(default=None),
) -> TranscriptionResponse:
    audio = await file.read()
    if not audio:
        raise AppError("The audio file is empty.")
    if len(audio) > MAX_AUDIO_BYTES:
        raise AppError("Audio file too large (max 10 MB).")
    text = await stt.transcribe(audio, language)
    return TranscriptionResponse(text=text)