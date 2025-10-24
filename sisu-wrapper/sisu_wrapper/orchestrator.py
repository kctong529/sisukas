import logging
from typing import List
from models import CourseOffering, StudyGroup
from client import SisuAPI

logger = logging.getLogger(__name__)


def fetch_course_offering(course_unit_id: str, offering_id: str
                          ) -> CourseOffering:
    course_unit_data = SisuAPI.fetch_course_unit(course_unit_id)
    assessment_item_ids = [
        item_id
        for method in course_unit_data.get("completionMethods", [])
        for item_id in method.get("assessmentItemIds", [])
    ]
    course_name = course_unit_data.get("name", {}).get("en", "Unnamed Course")
    flattened_groups: List[StudyGroup] = []
    for assessment_id in assessment_item_ids:
        realisations = SisuAPI.fetch_course_realisations(assessment_id)
        for real_data in realisations:
            if real_data.get("id") == offering_id:
                for group_set in real_data.get("studyGroupSets", []):
                    flattened_groups.extend(StudyGroup.from_api(group_set))
    return CourseOffering(
        course_unit_id=course_unit_id,
        offering_id=offering_id,
        name=course_name,
        assessment_items=assessment_item_ids,
        study_groups=flattened_groups
    )


def fetch_study_groups(course_unit_id: str, course_offering_id: str
                       ) -> List[StudyGroup]:
    """
    Convenience wrapper to fetch and flatten study groups for a given course

    Args:
        course_unit_id: The ID of the course unit in Sisu.
        course_offering_id: The ID of the specific course realisation.

    Returns:
        List of StudyGroup instances,
        each with its type, name, and study events.
    """
    offering = fetch_course_offering(course_unit_id, course_offering_id)
    if not offering.study_groups:
        logger.warning("No study groups found for this course offering.")
        return []
    return offering.study_groups
