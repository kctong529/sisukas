"""
Aalto University Sisu API Wrapper

A lightweight Python wrapper for fetching course data from the Aalto
University Sisu API.

Limitations:
    - Location/venue information is not available through the public API
    - Only published, upcoming/recent course realisations are included
    - Historical realisations require different endpoints

Example:
    >>> from sisu_wrapper import SisuClient, SisuService
    >>> with SisuClient() as client:
    ...     service = SisuService(client)
    ...     groups = service.fetch_study_groups(
    ...         "aalto-OPINKOHD-1125839311-20210801",
    ...         "aalto-CUR-206690-3122470"
    ...     )
"""

import logging

from .client import SisuClient
from .service import SisuService
from .models import StudyEvent, StudyGroup, CourseOffering
from .exceptions import (
    SisuAPIError, SisuHTTPError, SisuTimeoutError, 
    SisuConnectionError, SisuNotFoundError, SisuBatchError)

__version__ = "0.1.0"


logging.getLogger(__name__).addHandler(logging.NullHandler())


__all__ = [
    "SisuClient",
    "SisuService",
    "StudyEvent",
    "StudyGroup",
    "CourseOffering",
    "SisuAPIError",
    "SisuHTTPError",
    "SisuTimeoutError",
    "SisuConnectionError",
    "SisuNotFoundError",
    "SisuBatchError",
]
