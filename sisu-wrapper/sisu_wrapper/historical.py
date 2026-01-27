import json
import logging
from dataclasses import dataclass
from datetime import date
from typing import Any, Dict, List, Set

from .client import SisuClient
from .aalto_api_client import AaltoCourseApiClient
from .models_historical import CourseUnitRealisationSummary
from .historical_parsing import (
    parse_course_unit_assessment_index,
    parse_course_unit_realisation_summary,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DateRange:
    start: date
    end: date

    def contains(self, d: date) -> bool:
        return self.start <= d <= self.end

def read_course_unit_ids_from_courses_json(path: str) -> List[str]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError("courses.json must be a list")

    seen: Set[str] = set()
    out: List[str] = []

    for entry in data:
        if not isinstance(entry, dict):
            continue
        cu = entry.get("courseUnitId")
        if isinstance(cu, str) and cu not in seen:
            seen.add(cu)
            out.append(cu)

    return out

def extract_historical_realisation_ids_for_course_unit(
    sisu: SisuClient,
    course_unit_id: str,
    date_range: DateRange,
) -> List[str]:
    course_unit_data = sisu.fetch_course_unit(course_unit_id)

    index = parse_course_unit_assessment_index(
        course_unit_id,
        course_unit_data,
    )

    seen: Set[str] = set()
    out: List[str] = []

    for assessment_id in index.assessment_item_ids:
        raw_realisations = sisu.fetch_course_unit_realisations_all(assessment_id)

        for raw in raw_realisations:
            if not isinstance(raw, dict):
                continue

            summary = parse_course_unit_realisation_summary(raw)
            if summary is None:
                continue

            start = summary.activity_period.start_date
            if start is None:
                continue

            if date_range.contains(start) and summary.id not in seen:
                seen.add(summary.id)
                out.append(summary.id)

    return out

def fetch_historical_realisations_for_courses_json(
    courses_json_path: str,
    sisu: SisuClient,
    course_api: AaltoCourseApiClient,
    date_range: DateRange,
    limit_course_units: int | None = None,
    limit_realisations_per_unit: int | None = None,
) -> Dict[str, List[dict]]:
    course_unit_ids = read_course_unit_ids_from_courses_json(courses_json_path)

    if limit_course_units is not None:
        course_unit_ids = course_unit_ids[:limit_course_units]

    out: Dict[str, List[dict]] = {}

    for idx, course_unit_id in enumerate(course_unit_ids, start=1):
        logger.info("[%d/%d] %s", idx, len(course_unit_ids), course_unit_id)

        try:
            realisation_ids = extract_historical_realisation_ids_for_course_unit(
                sisu, course_unit_id, date_range
            )
        except Exception as e:
            logger.exception("Failed processing %s: %s", course_unit_id, e)
            out[course_unit_id] = []
            continue

        if limit_realisations_per_unit is not None:
            realisation_ids = realisation_ids[:limit_realisations_per_unit]

        records: List[dict] = []
        for rid in realisation_ids:
            try:
                records.append(course_api.fetch_course_unit_realisation(rid))
            except Exception as e:
                logger.warning("Failed fetching realisation %s: %s", rid, e)

        out[course_unit_id] = records

    return out
