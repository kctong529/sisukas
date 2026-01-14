"""
Low-level HTTP client for the Aalto Sisu API

This module handles all direct communication with the Sisu API endpoints,
including connection pooling, error handling, and request/response parsing.
"""

import logging
from typing import Any, Dict, List, Optional
import requests
from .exceptions import (
    SisuAPIError, SisuBatchError, SisuHTTPError, SisuTimeoutError, SisuConnectionError, SisuNotFoundError
)


logger = logging.getLogger(__name__)


class SisuClient:
    """
    Low-level HTTP client for the Aalto Sisu API

    Provides methods to fetch data from Sisu endpoints with robust
    error handling and connection pooling.
    """

    BASE_URL = "https://sisu.aalto.fi/kori/api"
    DEFAULT_TIMEOUT = 10

    def __init__(self, base_url: str | None = None, timeout: int = 10):
        """
        Initialize the Sisu API client

        Args:
            base_url: Override the default API base URL
            timeout: Default timeout for requests in seconds
        """
        self.base_url = base_url or self.BASE_URL
        self.timeout = timeout
        self._session: requests.Session | None = None

    @property
    def session(self) -> requests.Session:
        """Get or create a requests session for connection pooling"""
        if self._session is None:
            self._session = requests.Session()
            self._session.headers.update({
                'User-Agent': 'SisuAPI-Python-Wrapper/1.0'
            })
        return self._session

    def get_json(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        timeout: Optional[int] = None
    ) -> Dict[str, Any] | List[Dict[str, Any]]:
        """
        Send a GET request to the Sisu API and return the JSON response

        Args:
            endpoint: API endpoint path (e.g., '/course-units/123')
            params: Query parameters
            timeout: Request timeout (uses instance default if not specified)

        Returns:
            Parsed JSON response

        Raises:
            SisuHTTPError: If the HTTP request fails
            SisuTimeoutError: If the request times out
            SisuConnectionError: If connection fails
        """
        url = f"{self.base_url}{endpoint}"
        timeout = timeout or self.timeout

        try:
            logger.debug("GET %s with params=%s", url, params)
            response = self.session.get(
                url, params=params, timeout=timeout)
            response.raise_for_status()
            return response.json()
        except requests.HTTPError as exc:
            status_code = exc.response.status_code
            logger.error("HTTP error fetching %s: %s", url, exc)
            if status_code == 404:
                raise SisuNotFoundError(
                    f"Course unit {endpoint} not found") from exc
            raise SisuHTTPError(
                f"Failed to fetch {endpoint}: {status_code}",
                status_code=status_code
            ) from exc
        except requests.Timeout as exc:
            logger.error("Timeout fetching %s", url)
            raise SisuTimeoutError(
                f"Request to {endpoint} timed out after {timeout}s"
            ) from exc
        except requests.RequestException as exc:
            logger.error("Request error fetching %s: %s", url, exc)
            raise SisuConnectionError(
                f"Request failed for {endpoint}") from exc

    def fetch_course_unit(
        self,
        course_unit_id: str,
        timeout: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Fetch detailed metadata for a course unit

        Args:
            course_unit_id: The ID of the course unit
            timeout: Request timeout in seconds

        Returns:
            Course unit data dictionary
        """
        return self.get_json(
            f"/course-units/{course_unit_id}",
            timeout=timeout)

    def fetch_course_realisations(
        self,
        assessment_item_id: str,
        timeout: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieve all published course realisations linked
        to a specific assessment item

        This endpoint only returns upcoming or recently active realisations.
        Historical (older) realisations are not included, those are available
        through the broader /course-unit-realisations endpoint, which
        returns an unfiltered list spanning many years.

        Args:
            assessment_item_id: The assessment item ID
            timeout: Request timeout in seconds

        Returns:
            List of course realisation dictionaries
        """
        return self.get_json(
            "/course-unit-realisations/published",
            params={"assessmentItemId": assessment_item_id},
            timeout=timeout
        )

    def fetch_study_events(
        self,
        study_event_ids: List[str],
        timeout: Optional[int] = None
    ) -> List[Any]:
        """
        Fetch study events (e.g. lectures, exercises) by their IDs

        Returns basic event information including start/end times and
        cancellation status. Location/venue data is not included in the
        API response.

        Args:
            study_event_ids: List of study event IDs
            timeout: Request timeout in seconds

        Returns:
            List of study event data

        """
        return self.get_json(
            "/study-events",
            params={"id": ",".join(study_event_ids)},
            timeout=timeout
        )

    def fetch_course_units_batch(
        self,
        course_unit_ids: List[str],
        timeout: Optional[int] = None
    ) -> Dict[str, Dict[str, Any]]:
        """
        Fetch multiple course units in batch

        Args:
            course_unit_ids: List of course unit IDs to fetch
            timeout: Request timeout in seconds

        Returns:
            Dictionary mapping course_unit_id -> course unit data

        Raises:
            SisuBatchError: If any requests fail
        """
        results = {}
        errors = []

        for unit_id in course_unit_ids:
            try:
                results[unit_id] = self.fetch_course_unit(unit_id, timeout)
            except SisuAPIError as e:
                errors.append((unit_id, str(e)))
                logger.warning("Failed to fetch course unit %s: %s", unit_id, e)

        if errors:
            raise SisuBatchError(
                f"Batch fetch failed: {len(errors)}/{len(course_unit_ids)} failed",
                failed_requests=errors
            )

        return results

    def fetch_course_realisations_batch(
        self,
        assessment_item_ids: List[str],
        timeout: Optional[int] = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Fetch realisations for multiple assessment items in batch

        Args:
            assessment_item_ids: List of assessment item IDs
            timeout: Request timeout in seconds

        Returns:
            Dictionary mapping assessment_item_id -> list of realisations

        Raises:
            SisuBatchError: If any requests fail
        """
        results = {}
        errors = []

        for item_id in assessment_item_ids:
            try:
                results[item_id] = self.fetch_course_realisations(item_id, timeout)
            except SisuAPIError as e:
                errors.append((item_id, str(e)))
                logger.warning(
                    "Failed to fetch realisations for %s: %s", item_id, e)

        if errors:
            raise SisuBatchError(
                f"Batch fetch failed: {len(errors)}/{len(assessment_item_ids)} failed",
                failed_requests=errors
            )

        return results

    def close(self) -> None:
        """Close the requests session if it exists"""
        if self._session is not None:
            self._session.close()
            self._session = None

    def __enter__(self):
        """Context manager entry"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.close()
