"""
A lightweight Python wrapper for the Aalto University Sisu API

This module provides a simple interface for fetching structured JSON data
from Sisu's public Kori API endpoints. It includes helper methods for
retrieving course units, course realisations, and study events, with
robust error handling and connection pooling.

Limitations:
    - Location/venue information is not available through the public API
    - Only published, upcoming/recent course realisations are included
    - Historical realisations require different endpoints
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any
from datetime import datetime
import logging
import requests

logger = logging.getLogger(__name__)


def parse_datetime(iso_str):
    """Convert ISO string to datetime object"""
    return datetime.fromisoformat(iso_str) if iso_str else None


class SisuAPIError(Exception):
    """Custom exception for Sisu API errors"""


class SisuAPI:
    """
    Wrapper for the Aalto Sisu API

    Provides class methods to fetch data from Sisu endpoints including
    course units, course realisations, and study events.
    """

    BASE_URL = "https://sisu.aalto.fi/kori/api"
    _session: requests.Session | None = None

    @classmethod
    def get_session(cls) -> requests.Session:
        """Get or create a requests session for connection pooling"""
        if cls._session is None:
            cls._session = requests.Session()
            cls._session.headers.update({
                'User-Agent': 'SisuAPI-Python-Wrapper/1.0'
            })
        return cls._session

    @classmethod
    def get_json(
        cls,
        endpoint: str,
        params: Dict[str, Any] | None = None,
        timeout: int = 10
    ) -> dict | list:
        """
        Send a GET request to the Sisu API and return the JSON response
        """
        url = f"{cls.BASE_URL}{endpoint}"
        session = cls.get_session()

        try:
            logger.debug("GET %s with params=%s", url, params)
            response = session.get(url, params=params, timeout=timeout)
            response.raise_for_status()
            return response.json()
        except requests.HTTPError as exc:
            logger.error("HTTP error fetching %s: %s", url, exc)
            raise SisuAPIError(
                f"Failed to fetch {endpoint}: {exc.response.status_code}"
            ) from exc
        except requests.Timeout as exc:
            logger.error("Timeout fetching %s", url)
            raise SisuAPIError(
                f"Request to {endpoint} timed out after {timeout}s") from exc
        except requests.RequestException as exc:
            logger.error("Request error fetching %s: %s", url, exc)
            raise SisuAPIError(f"Request failed for {endpoint}") from exc

    @classmethod
    def fetch_course_unit(cls,
                          course_unit_id: str,
                          timeout: int = 10) -> Dict[str, Any]:
        """
        Fetch detailed metadata for a course unit
        """
        return cls.get_json(
            f"/course-units/{course_unit_id}",
            timeout=timeout)

    @classmethod
    def fetch_course_realisations(
        cls,
        assessment_item_id: str,
        timeout: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Retrieve all published course realisations linked to a specific
        assessment item

        This endpoint only returns upcoming or recently active realisations.
        Historical (older) realisations are not included — those are available
        through the broader /course-unit-realisations endpoint, which
        returns an unfiltered list spanning many years.
        """
        return cls.get_json(
            "/course-unit-realisations/published",
            params={"assessmentItemId": assessment_item_id},
            timeout=timeout
        )

    @classmethod
    def fetch_study_events(
        cls,
        study_event_ids: List[str],
        timeout: int = 10
    ) -> List[Any]:
        """
        Fetch study events (e.g., lectures, exercises) by their IDs

        Returns basic event information including start/end times and
        cancellation status. Location/venue data is not included in the
        API response.
        """
        return cls.get_json(
            "/study-events",
            params={"id": ",".join(study_event_ids)},
            timeout=timeout
        )

    @classmethod
    def close_session(cls) -> None:
        """Close the requests session if it exists"""
        if cls._session is not None:
            cls._session.close()
            cls._session = None


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

    def __repr__(self):
        fmt = "%d.%m.%Y (%a) %H:%M"
        try:
            start_formatted = parse_datetime(self.start).strftime(fmt)
            end_formatted = parse_datetime(self.end).strftime("%H:%M")
            return f"{start_formatted} – {end_formatted}"
        except Exception:
            return f"{self.start} – {self.end}"


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
            key=lambda e: datetime.fromisoformat(e.start)
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
                StudyEvent(start=event["start"], end=event["end"])
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

    @classmethod
    def from_api(cls, course_unit_id: str, offering_id: str
                 ) -> "CourseOffering":
        """Fetch course data and flatten study groups into a single object"""
        course_unit_data = SisuAPI.fetch_course_unit(course_unit_id)
        assessment_item_ids = [
            item_id
            for method in course_unit_data.get("completionMethods", [])
            for item_id in method.get("assessmentItemIds", [])
        ]
        course_name = course_unit_data.get(
            "name", {}).get("en", "Unnamed Course")

        flattened_groups: List[StudyGroup] = []
        for assessment_id in assessment_item_ids:
            realisations = SisuAPI.fetch_course_realisations(assessment_id)
            for real_data in realisations:
                if real_data.get("id") == offering_id:
                    for group_set in real_data.get("studyGroupSets", []):
                        flattened_groups.extend(
                            StudyGroup.from_api(group_set))

        return cls(
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
    course_offering = CourseOffering.from_api(course_unit_id,
                                              course_offering_id)
    if not course_offering.study_groups:
        logger.warning("No study groups found for this course offering.")
        return []
    return course_offering.study_groups


def main():
    """Demonstration of fetching course data and printing study events."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s: %(message)s"
    )

    # Example: Calculus 1 Lecture from Aalto Sisu Open API
    course_offering_id = "aalto-CUR-206690-3122470"
    course_unit_id = "aalto-OPINKOHD-1125839311-20210801"

    try:
        study_groups = fetch_study_groups(course_unit_id, course_offering_id)

        for study_group in study_groups:
            print(f"{study_group.type}: {study_group.name}")
            for event in study_group.sorted_events:
                print(f"  {event}")
            print()

    except SisuAPIError as e:
        logger.error("API error: %s", e)
    except Exception as e:
        logger.exception("Unexpected error: %s", e)
    finally:
        SisuAPI.close_session()
        logging.info("Session closed.")


if __name__ == "__main__":
    main()
