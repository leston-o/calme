import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index, String, Text, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AgentModel(Base):
    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100))
    business_name: Mapped[str] = mapped_column(String(200))
    business_description: Mapped[str] = mapped_column(Text)
    greeting: Mapped[str] = mapped_column(String(500))
    voice: Mapped[str] = mapped_column(String(32), default="Clara")
    # unique so each number maps to exactly one agent; many agents can have none
    phone_number: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True)
    phone_number_sid: Mapped[str | None] = mapped_column(String(64), nullable=True)
    phone_provider: Mapped[str | None] = mapped_column(String(20), nullable=True)
    fish_agent_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

class DemoBookingModel(Base):
    """A demo call a visitor booked from the landing page."""

    __tablename__ = "demo_bookings"
    __table_args__ = (
        # one confirmed booking per slot; cancelled ones free it up again
        Index(
            "uq_demo_bookings_confirmed_start",
            "starts_at",
            unique=True,
            postgresql_where=text("status = 'confirmed'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(200))
    business: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="confirmed")
    cancel_token: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
