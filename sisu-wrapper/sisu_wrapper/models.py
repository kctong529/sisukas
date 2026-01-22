"""
Data models for Sisu API entities

These dataclasses represent the domain objects returned by the Sisu API,
providing a clean interface for working with course data.

Limitations:
    - Location/venue information is not available through the public API
    - Multiple events with identical times typically indicate different venues
"""

from dataclasses import dataclass, field
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import List

HELSINKI = ZoneInfo("Europe/Helsinki")

@dataclass
class StudyEvent:
    """
    Represents a single study event with start and end times

    Note: Location/venue information is not available through the public
    Sisu API endpoints. Multiple events with identical times typically
    indicate different venues for the same session (e.g. exam halls).
    """
    start: str
    end: str
    start_iso: str | None = None
    end_iso: str | None = None

    def _parse(self, s: str) -> datetime:
        dt = datetime.fromisoformat(s)
        # If tz missing, assume Helsinki local time
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=HELSINKI)
        return dt

    @property
    def start_datetime(self) -> datetime:
        """Get start time as datetime object"""
        return self._parse(self.start)

    @property
    def end_datetime(self) -> datetime:
        """Get end time as datetime object"""
        return self._parse(self.end)
    
    def __post_init__(self):
        # Populate canonical ISO strings if not provided
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
        study_events: List of study events in this group
    """
    group_id: str
    name: str
    type: str
    study_events: List[StudyEvent] = field(default_factory=list)

    @property
    def sorted_events(self) -> List[StudyEvent]:
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
    assessment_items: List[str] = field(default_factory=list)
    study_groups: List[StudyGroup] = field(default_factory=list)

    def get_groups_by_type(self, group_type: str) -> List[StudyGroup]:
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
