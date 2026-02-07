"""
api/utils/responses.py
======================

Shared FastAPI "responses" dictionaries for endpoint documentation.

This module centralizes:
- A helper for standardized ErrorResponse documentation
- Per-endpoint response maps used in router decorators

This is documentation-facing only: it does not change runtime behavior,
but keeps OpenAPI specs consistent across endpoints.
"""

from models import ErrorResponse


def error_response(detail: str) -> dict:
    """Create a FastAPI responses entry using ErrorResponse + an example payload."""
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
    200: {"description": "Study groups retrieved successfully"},
    404: error_response("Course not found"),
    504: error_response("Sisu API timeout"),
    502: error_response("Sisu API unavailable"),
    500: error_response("Internal server error")
}

BATCH_STUDY_GROUPS_RESPONSES = {
    200: { "description": "Batch request processed successfully"},
    422: error_response("Invalid request format"),
    500: error_response("Internal server error")
}

BATCH_OFFERINGS_RESPONSES = {
    200: {"description": "Batch request processed successfully"},
    422: error_response("Invalid request format"),
    500: error_response("Internal server error")
}

RESOLVE_COURSE_RESPONSES = {
    200: {"description": "Resolved course code into one or more course unit candidates"},
    400: {"model": ErrorResponse, "description": "Invalid request"},
    502: {"model": ErrorResponse, "description": "Sisu API unavailable"},
    504: {"model": ErrorResponse, "description": "Sisu API timeout"},
    500: {"model": ErrorResponse, "description": "Internal server error"},
}
