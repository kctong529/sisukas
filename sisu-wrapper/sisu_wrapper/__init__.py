
"""
Python wrapper for Aalto University's SISU APIs.

Provides access to course offerings, study groups, expanded teaching
events, and optional room/building resolution.

Historical course realisations require separate API endpoints.
"""

import logging

from .client import SisuClient
from .exceptions import (
    SisuAPIError,
    SisuBatchError,
    SisuConnectionError,
    SisuHTTPError,
    SisuNotFoundError,
    SisuTimeoutError,
)
from .models import CourseOffering, StudyEvent, StudyGroup, StudyLocation
from .service import SisuService

__version__ = "0.5.0"

logging.getLogger(__name__).addHandler(logging.NullHandler())

__all__ = [
    "SisuClient",
    "SisuService",
    "StudyEvent",
    "StudyGroup",
    "StudyLocation",
    "CourseOffering",
    "SisuAPIError",
    "SisuHTTPError",
    "SisuTimeoutError",
    "SisuConnectionError",
    "SisuNotFoundError",
    "SisuBatchError",
]
