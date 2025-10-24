import logging
from typing import Any, Dict, List
import requests


logger = logging.getLogger(__name__)


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
