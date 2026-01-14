"""
api/utils/responses.py
======================

API Response Definitions for Sisu Wrapper

This module defines structured responses for all API endpoints in the
Sisu Wrapper, using Pydantic response models.

It includes:

- Error response utility: A function error_response() to generate
  standardized error responses.

- Endpoint-specific responses: Predefined response dictionaries for each
  endpoint, including success and error codes:

    - STUDY_GROUPS_RESPONSES:
        Responses for fetching study groups for a single course.
        - 200: Study groups retrieved successfully
        - 404: Course not found
        - 504: Sisu API timeout
        - 502: Sisu API unavailable
        - 500: Internal server error

    - BATCH_STUDY_GROUPS_RESPONSES:
        Responses for batch fetching study groups.
        - 200: Batch request processed
        - 422: Invalid request format
        - 500: Internal server error

    - BATCH_OFFERINGS_RESPONSES:
        Responses for batch fetching complete course offerings.
        - 200: Batch request processed
        - 422: Invalid request format
        - 500: Internal server error
"""

from models import ErrorResponse


def error_response(detail: str) -> dict:
    """
    Generate a standardized error response dictionary for FastAPI endpoints

    This function creates a response specification compatible with FastAPI's
    responses parameter. It uses the ErrorResponse model and provides an
    example JSON payload with the given error detail.

    Parameters
    ----------
    detail : str
        The error message to display

    Returns
    -------
    dict
        FastAPI response specification with model and example
    """
    return {
        "description": detail,
        "model": ErrorResponse,
        "content": {
            "application/json": {
                "example": {
                    "detail": detail
                }
            }
        }
    }


# ========================
# Endpoint-specific responses
# ========================

STUDY_GROUPS_RESPONSES = {
    200: {
        "description": "Study groups retrieved successfully"
    },
    404: error_response("Course not found"),
    504: error_response("Sisu API timeout"),
    502: error_response("Sisu API unavailable"),
    500: error_response("Internal server error")
}

BATCH_STUDY_GROUPS_RESPONSES = {
    200: {
        "description": "Batch request processed successfully"
    },
    422: error_response("Invalid request format"),
    500: error_response("Internal server error")
}

BATCH_OFFERINGS_RESPONSES = {
    200: {
        "description": "Batch request processed successfully"
    },
    422: error_response("Invalid request format"),
    500: error_response("Internal server error")
}