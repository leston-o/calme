"""When visitors can book a demo: fixed-length slots inside your working hours."""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from app.core.config import Settings

WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


@dataclass
class Slot:
    start: datetime  # UTC
    end: datetime  # UTC
    status: str  # "free" | "booked" | "past"


class DemoSchedule:
    def __init__(self, settings: Settings) -> None:
        self.tz = ZoneInfo(settings.demo_timezone)
        self.length = timedelta(minutes=settings.demo_slot_minutes)
        self.days_ahead = settings.demo_days_ahead
        self.notice = timedelta(hours=settings.demo_min_notice_hours)
        self.weekdays = {WEEKDAYS.index(d.strip().lower()[:3]) for d in settings.demo_weekdays.split(",") if d.strip()}
        self.day_start = time.fromisoformat(settings.demo_day_start)
        self.day_end = time.fromisoformat(settings.demo_day_end)

    def window(self, now: datetime) -> tuple[datetime, datetime]:
        """The UTC range covered by the calendar, from today to days_ahead."""
        today = now.astimezone(self.tz).date()
        start = datetime.combine(today, time.min, self.tz)
        return start.astimezone(timezone.utc), (start + timedelta(days=self.days_ahead)).astimezone(timezone.utc)

    def day_slots(self, day: date) -> list[tuple[datetime, datetime]]:
        if day.weekday() not in self.weekdays:
            return []
        slots = []
        cursor = datetime.combine(day, self.day_start, self.tz)
        close = datetime.combine(day, self.day_end, self.tz)
        while cursor + self.length <= close:
            slots.append((cursor.astimezone(timezone.utc), (cursor + self.length).astimezone(timezone.utc)))
            cursor += self.length
        return slots

    def calendar(self, now: datetime, booked: set[datetime]) -> list[tuple[date, list[Slot]]]:
        today = now.astimezone(self.tz).date()
        earliest = now + self.notice
        days = []
        for offset in range(self.days_ahead):
            day = today + timedelta(days=offset)
            slots = [
                Slot(s, e, "booked" if s in booked else "past" if s < earliest else "free")
                for s, e in self.day_slots(day)
            ]
            if slots:
                days.append((day, slots))
        return days

    def find(self, start: datetime, now: datetime) -> tuple[datetime, datetime] | None:
        """The slot starting at `start`, if it's a real, bookable slot."""
        start = start.astimezone(timezone.utc)
        if start < now + self.notice:
            return None
        day = start.astimezone(self.tz).date()
        if day > now.astimezone(self.tz).date() + timedelta(days=self.days_ahead - 1):
            return None
        return next(((s, e) for s, e in self.day_slots(day) if s == start), None)

    def describe(self, start: datetime, end: datetime) -> str:
        """e.g. 'Tuesday 18 November, 11:00–13:00 (EAT)'"""
        s, e = start.astimezone(self.tz), end.astimezone(self.tz)
        return f"{s:%A} {s.day} {s:%B}, {s:%H:%M}–{e:%H:%M} ({s:%Z})"
