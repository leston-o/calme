import re
from typing import Literal

from app.providers.base import ChatMessage, LLMProvider

RefineField = Literal["business_description", "hours", "services", "other", "greeting"]

_RULES = """RULES
- Keep every fact the owner wrote. Never add facts, prices, hours, services or policies that are not in their text.
- If something is unclear, keep it as written rather than guessing.
- Fix spelling and grammar. Use plain, friendly language.
- Reply with the rewritten text only. No introduction, no explanation, no quotes, no markdown symbols like ** or #."""

_TASKS: dict[str, str] = {
    "business_description": """Rewrite the owner's notes into clear information a phone receptionist can use to answer callers.
Organise it into short sections with plain headings on their own line, for example "Opening hours:", "Services and prices:", "Bookings:", "Location:". Use a simple "- " list where it helps.""",
    "hours": "Rewrite these opening hours so they are clear and complete, one line per day or group of days.",
    "services": 'Rewrite this list of services and prices clearly, one item per line starting with "- ".',
    "other": 'Rewrite these notes for callers clearly, one point per line starting with "- ".',
    "greeting": """Rewrite this into a warm, natural phone greeting that is spoken aloud.
Keep it under 25 words, one or two sentences, and end by offering help.""",
}

# Small local models like to announce their answer; strip that.
_PREAMBLE = re.compile(
    r"^\s*(here(?:'s| is)[^\n:]*:|sure[^\n:]*:|rewritten[^\n:]*:|greeting:)\s*",
    re.IGNORECASE,
)


def _clean(text: str) -> str:
    text = _PREAMBLE.sub("", text.strip())
    text = text.replace("**", "").replace("__", "")
    text = re.sub(r"^#+\s*", "", text, flags=re.MULTILINE)
    if len(text) > 1 and text[0] == text[-1] and text[0] in "\"'“”":
        text = text[1:-1]
    return text.strip()


async def refine_text(
    llm: LLMProvider,
    field: RefineField,
    text: str,
    business_name: str | None = None,
    assistant_name: str | None = None,
) -> str:
    context = []
    if business_name:
        context.append(f"Business name: {business_name}")
    if assistant_name:
        context.append(f"Assistant name: {assistant_name}")
    system = (
        "You help small local business owners write the information their AI phone assistant uses.\n\n"
        f"TASK\n{_TASKS[field]}\n\n{_RULES}"
    )
    prompt = ("\n".join(context) + "\n\n" if context else "") + f"OWNER'S TEXT\n{text}"
    reply = await llm.complete(system, [ChatMessage(role="user", content=prompt)])
    return _clean(reply)
