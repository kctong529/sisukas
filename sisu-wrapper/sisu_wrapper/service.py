"""
High-level service layer for interacting with Sisu API

This module provides business logic for fetching and transforming
course data into domain objects.
"""

import logging
from datetime import date
from typing import List, Dict, Any, Tuple, Optional
from functools import lru_cache

from .models import CourseOffering, StudyGroup, StudyEvent
from .client import SisuClient
from .aalto_api_client import AaltoCourseApiClient
from .historical import DateRange, extract_historical_realisation_ids_for_assessment_items
from .historical_parsing import parse_course_unit_assessment_index

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
    
    def resolve_course_snapshots_by_code(
        self,
        course_code: str,
        course_api: AaltoCourseApiClient,
        university_org_id: str = "aalto-university-root-id",
        date_range: Optional[DateRange] = None,
        limit_search_results: int = 20,
        limit_realisations: Optional[int] = None,
        timeout: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Resolve a course code into course unit realisation snapshots (CUR payloads)

        If multiple exact matches exist for the course code, all matches are processed.
        """
        q = course_code.strip()
        if not q:
            return {
                "courseCode": course_code,
                "status": "not_found",
                "courseUnitIds": [],
                "assessmentItemIds": [],
                "matches": [],
            }

        search = self.client.search_course_units(
            full_text_query=q,
            university_org_id=university_org_id,
            start=0,
            limit=limit_search_results,
            timeout=timeout,
        )

        results = search.get("searchResults") or []
        if not isinstance(results, list):
            results = []
        results = [r for r in results if isinstance(r, dict)]

        # Prefer exact code matches since fullTextQuery is fuzzy.
        exact = [
            r for r in results
            if str(r.get("code", "")).strip().upper() == q.upper()
        ]

        selected = exact if exact else results

        if not selected:
            return {
                "courseCode": q,
                "status": "not_found",
                "courseUnitIds": [],
                "assessmentItemIds": [],
                "matches": [],
            }

        if date_range is None:
            date_range = DateRange(start=date(2022, 9, 1), end=date(2100, 1, 1))

        course_unit_ids: List[str] = []
        all_assessment_item_ids: List[str] = []
        seen_assessment: set[str] = set()

        matches: List[Dict[str, Any]] = []
        seen_cur_ids: set[str] = set()

        for picked in selected:
            course_unit_id = picked.get("id")
            if not isinstance(course_unit_id, str) or not course_unit_id:
                continue

            course_unit_ids.append(course_unit_id)

            assessment_item_ids = picked.get("assessmentItemIds") or []
            if not isinstance(assessment_item_ids, list):
                assessment_item_ids = []
            assessment_item_ids = [x for x in assessment_item_ids if isinstance(x, str)]

            # Fallback: if search result does not provide assessmentItemIds, fetch course unit.
            if not assessment_item_ids:
                try:
                    cu = self.client.fetch_course_unit(course_unit_id, timeout=timeout)
                    index = parse_course_unit_assessment_index(course_unit_id, cu)
                    assessment_item_ids = index.assessment_item_ids
                except Exception as e:
                    logger.warning("Failed fetching assessmentItemIds for %s: %s", course_unit_id, e)
                    assessment_item_ids = []

            for aid in assessment_item_ids:
                if aid not in seen_assessment:
                    seen_assessment.add(aid)
                    all_assessment_item_ids.append(aid)

            if not assessment_item_ids:
                continue

            cur_ids = extract_historical_realisation_ids_for_assessment_items(
                sisu=self.client,
                assessment_item_ids=assessment_item_ids,
                date_range=date_range,
            )

            if limit_realisations is not None:
                remaining = limit_realisations - len(matches)
                if remaining <= 0:
                    break
                cur_ids = cur_ids[:remaining]

            for cur_id in cur_ids:
                if cur_id in seen_cur_ids:
                    continue
                seen_cur_ids.add(cur_id)

                try:
                    rec = course_api.fetch_course_unit_realisation(cur_id)
                except Exception as e:
                    logger.warning("Failed fetching CUR %s: %s", cur_id, e)
                    continue

                # Preserve payload courseUnitId if it exists; only fill if missing.
                if isinstance(rec, dict) and "courseUnitId" not in rec:
                    rec["courseUnitId"] = course_unit_id

                matches.append(rec)

        # Deduplicate courseUnitIds while preserving order
        deduped_course_unit_ids: List[str] = []
        seen_cu: set[str] = set()
        for cu in course_unit_ids:
            if cu not in seen_cu:
                seen_cu.add(cu)
                deduped_course_unit_ids.append(cu)

        status = "ok" if deduped_course_unit_ids else "not_found"

        return {
            "courseCode": q,
            "status": status,
            "courseUnitIds": deduped_course_unit_ids,
            "assessmentItemIds": all_assessment_item_ids,
            "matches": matches,
        }
