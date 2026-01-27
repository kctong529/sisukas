"""
Client for Aalto Open Course API

Fetches historical course-unit realisation details by realisation id.
API key must be provided via env var, not hardcoded.
"""

import os
import logging
from typing import Any, Dict, Optional
import requests

from .exceptions import SisuHTTPError, SisuTimeoutError, SisuConnectionError

logger = logging.getLogger(__name__)


class AaltoCourseApiClient:
    BASE_URL = "https://course.api.aalto.fi/api/sisu/v1"
    DEFAULT_TIMEOUT = 15
    ENV_KEY_NAME = "AALTO_COURSE_API_KEY"

    def __init__(self, base_url: str | None = None, timeout: int = DEFAULT_TIMEOUT):
        self.base_url = base_url or self.BASE_URL
        self.timeout = timeout
        self._session: requests.Session | None = None

    @property
    def session(self) -> requests.Session:
        if self._session is None:
            self._session = requests.Session()
            self._session.headers.update({"User-Agent": "Sisukas-Historical-Fetch/1.0"})
        return self._session

    def _get_api_key(self) -> str:
        key = os.getenv(self.ENV_KEY_NAME)
        if not key:
            raise RuntimeError(
                f"Missing Course API key. Set env var {self.ENV_KEY_NAME}."
            )
        return key

    def get_json(
        self,
        endpoint: str,
        timeout: Optional[int] = None,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        timeout = timeout or self.timeout
        params = {"USER_KEY": self._get_api_key()}

        try:
            logger.debug("GET %s", url)
            resp = self.session.get(url, params=params, timeout=timeout)
            resp.raise_for_status()
            return resp.json()
        except requests.HTTPError as exc:
            status_code = exc.response.status_code if exc.response else None
            logger.error("HTTP error fetching %s: %s", url, exc)
            raise SisuHTTPError(
                f"Failed to fetch {endpoint}: {status_code}",
                status_code=status_code,
            ) from exc
        except requests.Timeout as exc:
            logger.error("Timeout fetching %s", url)
            raise SisuTimeoutError(f"Request to {endpoint} timed out after {timeout}s") from exc
        except requests.RequestException as exc:
            logger.error("Request error fetching %s: %s", url, exc)
            raise SisuConnectionError(f"Request failed for {endpoint}") from exc

    def fetch_course_unit_realisation(
        self,
        realisation_id: str,
        timeout: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Endpoint:
          GET /courseunitrealisations/{id}?USER_KEY=...

        Returns:
          One historical realisation record.
        """
        return self.get_json(f"/courseunitrealisations/{realisation_id}", timeout=timeout)

    def close(self) -> None:
        if self._session is not None:
            self._session.close()
            self._session = None
