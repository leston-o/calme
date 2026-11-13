from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.api.deps import LLMDep
from app.core.errors import AppError
from app.services.refine import RefineField, refine_text

router = APIRouter(prefix="/assist", tags=["assist"])


class RefineRequest(BaseModel):
    field: RefineField
    text: str = Field(min_length=1, max_length=10_000)
    business_name: str | None = Field(default=None, max_length=200)
    assistant_name: str | None = Field(default=None, max_length=100)


class RefineResponse(BaseModel):
    text: str


@router.post("/refine", response_model=RefineResponse)
async def refine(body: RefineRequest, llm: LLMDep) -> RefineResponse:
    """Polish text an owner wrote (description, hours, greeting...) without adding facts."""
    text = await refine_text(
        llm, body.field, body.text.strip(), body.business_name, body.assistant_name
    )
    if not text:
        raise AppError("The AI couldn't improve this text. Please try again.")
    return RefineResponse(text=text)
