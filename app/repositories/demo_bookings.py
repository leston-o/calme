from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.errors import ConflictError
from app.db.models import DemoBookingModel

SLOT_TAKEN = "Someone has just booked that time. Please pick another."


@dataclass
class DemoBooking:
    starts_at: datetime
    ends_at: datetime
    name: str
    email: str
    business: str
    phone: str | None
    message: str | None
    cancel_token: str
    status: str = "confirmed"
    id: UUID = field(default_factory=uuid4)


class DemoBookingRepository(ABC):
    @abstractmethod
    async def booked_starts(self, start: datetime, end: datetime) -> set[datetime]:
        """Start times of confirmed bookings in [start, end)."""

    @abstractmethod
    async def create(self, booking: DemoBooking) -> DemoBooking:
        """Save it, or raise ConflictError if the slot is already taken."""

    @abstractmethod
    async def get(self, booking_id: UUID) -> DemoBooking | None: ...

    @abstractmethod
    async def set_status(self, booking_id: UUID, status: str) -> None: ...


def _utc(dt: datetime) -> datetime:
    return dt.astimezone(timezone.utc)


def _from_row(row: DemoBookingModel) -> DemoBooking:
    return DemoBooking(
        id=row.id,
        starts_at=_utc(row.starts_at),
        ends_at=_utc(row.ends_at),
        name=row.name,
        email=row.email,
        business=row.business,
        phone=row.phone,
        message=row.message,
        cancel_token=row.cancel_token,
        status=row.status,
    )


class PostgresDemoBookingRepository(DemoBookingRepository):
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def booked_starts(self, start: datetime, end: datetime) -> set[datetime]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(DemoBookingModel.starts_at).where(
                    DemoBookingModel.status == "confirmed",
                    DemoBookingModel.starts_at >= start,
                    DemoBookingModel.starts_at < end,
                )
            )
            return {_utc(s) for s in result.scalars()}

    async def create(self, booking: DemoBooking) -> DemoBooking:
        async with self._session_factory() as session:
            session.add(
                DemoBookingModel(
                    id=booking.id,
                    starts_at=booking.starts_at,
                    ends_at=booking.ends_at,
                    name=booking.name,
                    email=booking.email,
                    business=booking.business,
                    phone=booking.phone,
                    message=booking.message,
                    status=booking.status,
                    cancel_token=booking.cancel_token,
                )
            )
            try:
                await session.commit()
            except IntegrityError as exc:  # the unique index on confirmed slots
                raise ConflictError(SLOT_TAKEN) from exc
            return booking

    async def get(self, booking_id: UUID) -> DemoBooking | None:
        async with self._session_factory() as session:
            row = await session.get(DemoBookingModel, booking_id)
            return _from_row(row) if row else None

    async def set_status(self, booking_id: UUID, status: str) -> None:
        async with self._session_factory() as session:
            row = await session.get(DemoBookingModel, booking_id)
            if row is not None:
                row.status = status
                await session.commit()


class InMemoryDemoBookingRepository(DemoBookingRepository):
    """Development storage. Bookings are lost on restart."""

    def __init__(self) -> None:
        self._items: dict[UUID, DemoBooking] = {}

    async def booked_starts(self, start: datetime, end: datetime) -> set[datetime]:
        return {
            b.starts_at
            for b in self._items.values()
            if b.status == "confirmed" and start <= b.starts_at < end
        }

    async def create(self, booking: DemoBooking) -> DemoBooking:
        if booking.starts_at in await self.booked_starts(booking.starts_at, booking.ends_at):
            raise ConflictError(SLOT_TAKEN)
        self._items[booking.id] = booking
        return booking

    async def get(self, booking_id: UUID) -> DemoBooking | None:
        return self._items.get(booking_id)

    async def set_status(self, booking_id: UUID, status: str) -> None:
        if booking_id in self._items:
            self._items[booking_id].status = status
