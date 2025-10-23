"""
A lightweight Python wrapper for the Aalto University Sisu API

This module provides a simple interface for fetching structured JSON data
from Sisu’s public Kori API endpoints. It includes helper methods for
retrieving course units, course realisations, and study events, with
robust error handling and connection pooling.
"""

from typing import List, Optional, Dict, Any
import logging
import json
import requests

logger = logging.getLogger(__name__)


class SisuAPIError(Exception):
    """Custom exception for Sisu API errors"""


class SisuAPI:
    """
    A simple wrapper for the Aalto Sisu API

    This class provides static methods for fetching data from various
    Sisu endpoints such as course units, course realisations, and study events.
    """

    BASE = "https://sisu.aalto.fi/kori/api"
    _session: Optional[requests.Session] = None

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
        path: str,
        params: Optional[Dict[str, Any]] = None,
        timeout: int = 10
    ) -> Dict[str, Any]:
        """
        Send a GET request to the Sisu API and return the JSON response
        """
        url = f"{cls.BASE}{path}"
        session = cls.get_session()

        try:
            logger.debug("GET %s with params=%s", url, params)
            r = session.get(url, params=params, timeout=timeout)
            r.raise_for_status()
            return r.json()
        except requests.HTTPError as e:
            logger.error("HTTP error fetching %s: %s", url, e)
            raise SisuAPIError(
                f"Failed to fetch {path}: {e.response.status_code}") from e
        except requests.Timeout as e:
            logger.error("Timeout fetching %s", url)
            raise SisuAPIError(
                f"Request to {path} timed out after {timeout}s") from e
        except requests.RequestException as e:
            logger.error("Request error fetching %s: %s", url, e)
            raise SisuAPIError(f"Request failed for {path}") from e

    @classmethod
    def fetch_course_unit(cls,
                          course_unit_id: str,
                          timeout: int = 10) -> Dict[str, Any]:
        """
        Fetch detailed information about a specific course unit
        """
        return cls.get_json(
            f"/course-units/{course_unit_id}",
            timeout=timeout)

    @classmethod
    def fetch_course_realisations(
        cls,
        assessment_item_id: str,
        timeout: int = 10
    ) -> List[Any]:
        """
        Fetch all published course realisations for a given assessment item
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


def shorten_lists(obj, max_items: int = 1):
    """
    Recursively traverse JSON-like data (dict/list) and keep only the first
    max_items elements from any list,
    appending a truncation note if there are more.
    """
    if isinstance(obj, list):
        if not obj:
            return []
        shortened = [shorten_lists(x, max_items) for x in obj[:max_items]]
        if len(obj) > max_items:
            shortened.append(f"... ({len(obj) - max_items} more items)")
        return shortened
    if isinstance(obj, dict):
        return {k: shorten_lists(v, max_items) for k, v in obj.items()}
    return obj


def main():
    # Configure logging for demonstration
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s: %(message)s"
    )

    # Example course unit ID from Aalto Sisu Open API
    course_unit_id = "aalto-OPINKOHD-1125839311-20210801"
    assessment_item_id = "aalto-AI-1125839311-20210801-1-3"
    study_event_ids = [
        'aalto-SE-ASIO-3122465-6716317',
        'aalto-SE-ASIO-3122465-6716316',
        'aalto-SE-ASIO-3122465-6716315',
        'aalto-SE-ASIO-3122465-6716326'
    ]

    try:
        logging.info("Fetching course unit...")
        course_data = SisuAPI.fetch_course_unit(course_unit_id)
        print("\n=== Course Unit ===")
        print(json.dumps(shorten_lists(course_data),
                         indent=2, ensure_ascii=False))

        logging.info("Fetching course realisations...")
        realisations = SisuAPI.fetch_course_realisations(assessment_item_id)
        print("\n=== Course Realisations ===")
        print(json.dumps(shorten_lists(realisations),
                         indent=2, ensure_ascii=False))

        logging.info("Fetching study events...")
        data = SisuAPI.fetch_study_events(study_event_ids)
        print("\n=== Study Events ===")
        print(json.dumps(shorten_lists(data), indent=2, ensure_ascii=False))

    except SisuAPIError as e:
        logger.error("API error: %s", e)
    except Exception as e:
        logger.exception("Unexpected error: %s", e)
    finally:
        SisuAPI.close_session()
        logging.info("Session closed.")


if __name__ == "__main__":
    main()
