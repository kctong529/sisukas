"""
High-level service layer for interacting with Sisu API

This module provides business logic for fetching and transforming
course data into domain objects.
"""

import logging
from typing import List, Dict, Any, Tuple
from functools import lru_cache
from .models import CourseOffering, StudyGroup, StudyEvent
from .client import SisuClient

logger = logging.getLogger(__name__)


class SisuService:
    """
    High-level service for working with Sisu course data

    Handles the orchestration of API calls and transformation of
    raw API responses into domain objects.
    """

    def __init__(self, client: SisuClient):
        """Initialize the service with a Sisu client"""
        self.client = client

    @lru_cache(maxsize=128)
    def fetch_course_offering(
        self,
        course_unit_id: str,
        offering_id: str
    ) -> CourseOffering:
        """
        Fetch complete course offering data including all study groups

        Args:
            course_unit_id: The ID of the course unit in Sisu
            offering_id: The ID of the specific course realisation

        Returns:
            CourseOffering object with all associated data
        """
        course_unit_data = self.client.fetch_course_unit(course_unit_id)

        assessment_item_ids = [
            item_id
            for method in course_unit_data.get("completionMethods", [])
            for item_id in method.get("assessmentItemIds", [])
        ]

        course_name = course_unit_data.get(
            "name", {}).get("en", "Unnamed Course")

        # Collect all matching realisations
        matching_realisations = []
        for assessment_id in assessment_item_ids:
            for real_data in self.client.fetch_course_realisations(
                    assessment_id):
                if real_data.get("id") == offering_id:
                    matching_realisations.append(real_data)

        # Collect all study groups from those realisations
        all_groups = []
        for real_data in matching_realisations:
            for group_set in real_data.get("studyGroupSets", []):
                all_groups.extend(self._parse_study_groups(group_set))

        # Deduplicate by group_id
        flattened_groups = []
        seen_ids = set()
        for group in all_groups:
            if group.group_id not in seen_ids:
                flattened_groups.append(group)
                seen_ids.add(group.group_id)

        return CourseOffering(
            course_unit_id=course_unit_id,
            offering_id=offering_id,
            name=course_name,
            assessment_items=assessment_item_ids,
            study_groups=flattened_groups
        )

    def fetch_study_groups(
        self,
        course_unit_id: str,
        course_offering_id: str
    ) -> List[StudyGroup]:
        """
        Convenience method to fetch only study groups for a course offering

        Args:
            course_unit_id: The ID of the course unit in Sisu
            course_offering_id: The ID of the specific course realisation

        Returns:
            List of StudyGroup instances
        """
        course_offering = self.fetch_course_offering(
            course_unit_id, course_offering_id)

        if not course_offering.study_groups:
            logger.debug(
                "No study groups found for course %s, offering %s",
                course_unit_id,
                course_offering_id
            )

        return course_offering.study_groups

    def fetch_course_offerings_batch(
        self,
        requests: List[Tuple[str, str]]
    ) -> Dict[Tuple[str, str], CourseOffering | None]:
        """
        Fetch multiple course offerings in a single batch

        Args:
            requests: List of (course_unit_id, offering_id) tuples

        Returns:
            Dictionary mapping (course_unit_id, offering_id) -> CourseOffering
            Failed requests map to None

        Example:
            offerings = service.fetch_course_offerings_batch([
                ("unit-1", "offering-1"),
                ("unit-2", "offering-2"),
            ])
        """
        results = {}

        for course_unit_id, offering_id in requests:
            key = (course_unit_id, offering_id)
            try:
                results[key] = self.fetch_course_offering(
                    course_unit_id, offering_id
                )
            except Exception as e:
                logger.error(
                    "Failed to fetch offering %s/%s: %s",
                    course_unit_id, offering_id, e
                )
                results[key] = None

        return results

    def fetch_study_groups_batch(
        self,
        requests: List[Tuple[str, str]]
    ) -> Dict[Tuple[str, str], List[StudyGroup]]:
        """
        Fetch study groups for multiple course offerings in a batch

        Args:
            requests: List of (course_unit_id, course_offering_id) tuples

        Returns:
            Dictionary mapping tuple -> list of StudyGroup objects
            Failed requests map to empty list

        Example:
            groups = service.fetch_study_groups_batch([
                ("unit-1", "offering-1"),
                ("unit-2", "offering-2"),
            ])
        """
        results = {}

        for course_unit_id, course_offering_id in requests:
            key = (course_unit_id, course_offering_id)
            try:
                results[key] = self.fetch_study_groups(
                    course_unit_id, course_offering_id
                )
            except Exception as e:
                logger.error(
                    "Failed to fetch study groups %s/%s: %s",
                    course_unit_id, course_offering_id, e
                )
                results[key] = []

        return results

    def _parse_study_groups(self, group_set_data: Dict[str, Any]
                            ) -> List[StudyGroup]:
        """
        Convert a group set with subgroups into a list of StudyGroup instances

        Args:
            group_set_data: Raw API data for a study group set

        Returns:
            List of parsed StudyGroup objects
        """
        flattened_groups: List[StudyGroup] = []
        group_type = group_set_data.get("name", {}).get("en", "Unknown")

        for sub_group_data in group_set_data.get("studySubGroups", []):
            study_event_ids = sub_group_data.get("studyEventIds", [])

            if not study_event_ids:
                continue

            event_records = self.client.fetch_study_events(study_event_ids)
            study_events = [
                StudyEvent(start=event["start"], end=event["end"])
                for record in event_records
                for event in record.get("events", [])
            ]

            flattened_groups.append(
                StudyGroup(
                    group_id=sub_group_data.get("id", ""),
                    name=sub_group_data.get("name", {}).get("en", ""),
                    type=group_type,
                    study_events=study_events
                )
            )

        return flattened_groups
