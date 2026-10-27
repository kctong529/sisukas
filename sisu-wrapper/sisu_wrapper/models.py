"""
Data models for Sisu API entities

These dataclasses represent the domain objects returned by the Sisu API,
providing a clean interface for working with course data.

Study events include source series IDs, occurrence status, and location IDs.
Room and building details require separate location lookups.
"""

from dataclasses import dataclass, field
from datetime import datetime
from zoneinfo import ZoneInfo

HELSINKI = ZoneInfo("Europe/Helsinki")


@dataclass
class StudyEvent:
    """
    One expanded occurrence belonging to a SISU study-event series.

    series_id identifies the source series, not an individual occurrence.
    location_ids contains the effective room IDs, using any occurrence-
    level override instead of the series defaults. Room details are not yet
    resolved. Naive timestamps are interpreted as Europe/Helsinki local time.
    """
    start: str
    end: str
    start_iso: str | None = None
    end_iso: str | None = None
    series_id: str | None = None
    cancelled: bool = False
    excluded: bool = False
    notice: str | None = None
    location_ids: list[str] = field(default_factory=list)

    @staticmethod
    def _parse(s: str) -> datetime:
        dt = datetime.fromisoformat(s)
        # SISU event timestamps are local when no offset is supplied.
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=HELSINKI)
        return dt

    @property
    def start_datetime(self) -> datetime:
        """Return the timezone-aware occurrence start."""
        return self._parse(self.start)

    @property
    def end_datetime(self) -> datetime:
        """Return the timezone-aware occurrence end."""
        return self._parse(self.end)

    def __post_init__(self) -> None:
        # Preserve explicitly supplied ISO values for existing consumers.
        if self.start_iso is None:
            self.start_iso = self.start_datetime.isoformat()
        if self.end_iso is None:
            self.end_iso = self.end_datetime.isoformat()


@dataclass
class StudyGroup:
    """
    Represents a flattened study group, such as a lecture or exercise

    Attributes:
        group_id: Unique ID of the study group
        name: Name of the group (e.g. 'L01', 'H02')
        type: Group type (e.g. 'Lecture', 'Exercise', 'Exam')
        study_events: Expanded occurrences in this group
    """
    group_id: str
    name: str
    type: str
    study_events: list[StudyEvent] = field(default_factory=list)

    @property
    def sorted_events(self) -> list[StudyEvent]:
        """Return study events sorted by start time"""
        return sorted(self.study_events, key=lambda e: e.start_datetime)

    def __repr__(self) -> str:
        return f"{self.type}: {self.name} ({len(self.study_events)} events)"


@dataclass
class CourseOffering:
    """
    Represents a single course offering,
    combining the course unit and its realisation
    """
    course_unit_id: str
    offering_id: str
    name: str
    assessment_items: list[str] = field(default_factory=list)
    study_groups: list[StudyGroup] = field(default_factory=list)

    def get_groups_by_type(self, group_type: str) -> list[StudyGroup]:
        """
        Get all study groups of a specific type

        Args:
            group_type: The type to filter by (e.g. 'Lecture', 'Exercise')

        Returns:
            List of matching study groups
        """
        return [g for g in self.study_groups if g.type == group_type]

    def __repr__(self) -> str:
        return f"{self.name} ({len(self.study_groups)} groups)"
