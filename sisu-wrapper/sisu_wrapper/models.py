from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Any
from client import SisuAPI


@dataclass
class StudyEvent:
    """
    Represents a single study event with start and end times

    Note: Location/venue information is not available through the public
    Sisu API endpoints. Multiple events with identical times typically
    indicate different venues for the same session (e.g. exam halls).
    """
    start: datetime
    end: datetime

    def __repr__(self):
        fmt = "%d.%m.%Y (%a) %H:%M"
        return f"{self.start.strftime(fmt)} – {self.end.strftime('%H:%M')}"

    @classmethod
    def from_api(cls, data: dict[str, Any]) -> "StudyEvent":
        """Convert API event dict into a StudyEvent with datetime fields"""
        start = datetime.fromisoformat(data["start"])
        end = datetime.fromisoformat(data["end"])
        return cls(start=start, end=end)


@dataclass
class StudyGroup:
    """
    Represents a flattened study group, such as a lecture or exercise

    Attributes:
        group_id: Unique ID of the study group
        name: Name of the group
        type: Group type (Lecture, Exercise, Exam)
        study_events: List of study events in this group
    """
    group_id: str
    name: str
    type: str
    study_events: List[StudyEvent] = field(default_factory=list)

    @property
    def sorted_events(self) -> List[StudyEvent]:
        """Return study events sorted by start time"""
        return sorted(
            self.study_events,
            key=lambda e: e.start
        )

    @classmethod
    def from_api(cls, group_set_data: Dict[str, Any]) -> List["StudyGroup"]:
        """
        Convert a group set with subgroups
        into a list of flattened StudyGroup instances
        """
        flattened_groups: List[StudyGroup] = []
        group_type = group_set_data.get("name", {}).get("en", "Unknown")

        for sub_group_data in group_set_data.get("studySubGroups", []):
            study_event_ids = sub_group_data.get("studyEventIds", [])
            event_records = SisuAPI.fetch_study_events(study_event_ids)
            study_events = [
                StudyEvent.from_api(event)
                for record in event_records
                for event in record.get("events", [])
            ]

            flattened_groups.append(
                cls(
                    group_id=sub_group_data.get("id", ""),
                    name=sub_group_data.get("name", {}).get("en", ""),
                    type=group_type,
                    study_events=study_events
                )
            )
        return flattened_groups


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
