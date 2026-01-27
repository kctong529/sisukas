from datetime import date
from typing import Dict, List, Optional

from .models_historical import (
    ActivityPeriod,
    CourseUnitAssessmentIndex,
    CourseUnitRealisationSummary,
)


def _parse_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return date.fromisoformat(s)
    except ValueError:
        return None

def parse_course_unit_assessment_index(
    course_unit_id: str,
    course_unit_data: Dict[str, object],
) -> CourseUnitAssessmentIndex:
    completion_methods = course_unit_data.get("completionMethods", []) or []

    assessment_item_ids: List[str] = []
    for method in completion_methods:
        if not isinstance(method, dict):
            continue
        for item_id in method.get("assessmentItemIds", []) or []:
            if isinstance(item_id, str):
                assessment_item_ids.append(item_id)

    return CourseUnitAssessmentIndex(
        course_unit_id=course_unit_id,
        assessment_item_ids=assessment_item_ids,
    )

def parse_course_unit_realisation_summary(
    data: Dict[str, object],
) -> Optional[CourseUnitRealisationSummary]:
    rid = data.get("id")
    if not isinstance(rid, str):
        return None

    ap = data.get("activityPeriod") or {}
    if not isinstance(ap, dict):
        ap = {}

    start = _parse_date(ap.get("startDate"))
    end = _parse_date(ap.get("endDate"))

    return CourseUnitRealisationSummary(
        id=rid,
        activity_period=ActivityPeriod(start, end),
    )
