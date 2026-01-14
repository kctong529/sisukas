"""
Custom exception classes for Sisu API errors

Provides a hierarchy of exceptions for different types of failures
when interacting with the Aalto University Sisu API.
"""

from typing import List


class SisuAPIError(Exception):
    """Base exception for Sisu API errors"""


class SisuHTTPError(SisuAPIError):
    """HTTP error from Sisu API"""
    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.status_code = status_code


class SisuTimeoutError(SisuAPIError):
    """Request timeout error"""


class SisuConnectionError(SisuAPIError):
    """Connection error"""


class SisuNotFoundError(SisuAPIError):
    """Resource not found (404)"""


class SisuBatchError(SisuAPIError):
    """Batch operation failed partially or completely"""
    def __init__(self, message: str, failed_requests: List[tuple] = None):
        super().__init__(message)
        self.failed_requests = failed_requests or []
