"""
utils/responses.py
==================

Shared FastAPI response definitions for endpoint documentation.

This module centralizes:
- A helper for standardized ErrorResponse documentation
- Predefined response mappings used in router decorators

This is documentation-only and does not affect runtime behavior.
"""

from models.response_models import (
    PostResponse,
    GetResponse,
    DeleteResponse,
    RootResponse,
    ErrorResponse
)


def error_response(detail: str) -> dict:
    """
    Generate a standardized error response dictionary for FastAPI endpoints

    This function creates a response specification compatible with FastAPI's
    responses parameter. It uses the ErrorResponse model and provides an
    example JSON payload with the given error detail.
    """
    return {
        "description": detail,
        "model": ErrorResponse,
        "content": {
            "application/json": {
                "example": {
                    "detail": detail}
            }
        }
    }


# ------------------------
# Endpoint-specific responses
# ------------------------


POST_RESPONSES = {
    201: {"description": "Filter created",
          "model": PostResponse},
    422: error_response("Invalid request data"),
    500: error_response("Internal server error")
}


GET_RESPONSES = {
    200: {"description": "Filter retrieved successfully",
          "model": GetResponse},
    422: error_response("Invalid hash format"),
    404: error_response("Filter not found"),
    500: error_response("Internal server error")
}


DELETE_RESPONSES = {
    200: {"description": "Filter deleted successfully",
          "model": DeleteResponse},
    422: error_response("Invalid hash format"),
    404: error_response("Filter not found"),
    500: error_response("Internal server error")
}


ROOT_RESPONSES = {
    200: {"description": "API metadata retrieved successfully",
          "model": RootResponse},
    500: error_response("Internal server error")
}
