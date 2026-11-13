from datetime import datetime, timezone
from uuid import uuid4

from app.schemas.agent import Agent, AgentCreate

# Valid input
data = AgentCreate(
    name="Front desk",
    business_name="Sunrise Dental",
    business_description="Family dental clinic open Mon-Sat 8am-6pm.",
)
print(data)

# Turn it into a full stored agent
now = datetime.now(timezone.utc)
agent = Agent(id=uuid4(), created_at=now, updated_at=now, **data.model_dump())
print(agent.model_dump_json(indent=2))

# Invalid input: description too short
try:
    AgentCreate(name="x", business_name="y", business_description="short")
except Exception as e:
    print("Rejected:", e)