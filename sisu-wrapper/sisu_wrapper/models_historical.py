from dataclasses import dataclass
from datetime import date
from typing import List, Dict, Optional


@dataclass(frozen=True)
class ActivityPeriod:
    start_date: Optional[date]
    end_date: Optional[date]


@dataclass(frozen=True)
class CourseUnitRealisationSummary:
    """
    Minimal representation of a course-unit-realisations entry
    from /course-unit-realisations.
    """
    id: str
    activity_period: ActivityPeriod


@dataclass(frozen=True)
class CourseUnitAssessmentIndex:
    """
    Extracted assessment-item index from a course unit.
    """
    course_unit_id: str
    assessment_item_ids: List[str]
