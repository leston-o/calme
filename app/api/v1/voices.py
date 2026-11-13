from typing import get_args

from fastapi import APIRouter

from app.schemas.agent import Live3Voice

router = APIRouter(prefix="/voices", tags=["voices"])


@router.get("", response_model=list[str])
async def list_voices() -> list[str]:
    """The Live 3 voices an assistant can speak with. Clara is the default."""
    return list(get_args(Live3Voice))
