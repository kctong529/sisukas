"""
API Response Definitions for Sisukas Filters
=============================================

This module defines structured responses for all API endpoints in the
Sisukas Filters application, using Pydantic response models.

It includes:

- Error responses: A utility function error_response to generate
  standardized error responses with ErrorResponse model and example detail.

- Endpoint-specific responses: Predefined response dictionaries for each
  endpoint, including success and error codes:

    - POST_RESPONSES:
        Responses for creating a filter configuration.
        - 201: Filter created successfully (PostResponse)
        - 422: Invalid request data (ErrorResponse)
        - 500: Internal server error (ErrorResponse)

    - GET_RESPONSES:
        Responses for retrieving a filter configuration by hash.
        - 200: Filter retrieved successfully (GetResponse)
        - 422: Invalid hash format (ErrorResponse)
        - 404: Filter not found (ErrorResponse)
        - 500: Internal server error (ErrorResponse)

    - DELETE_RESPONSES:
        Responses for deleting a filter configuration.
        - 200: Filter deleted successfully (DeleteResponse)
        - 422: Invalid hash format (ErrorResponse)
        - 404: Filter not found (ErrorResponse)
        - 500: Internal server error (ErrorResponse)

    - ROOT_RESPONSES:
        Responses for the root metadata endpoint.
        - 200: Metadata retrieved successfully (RootResponse)
        - 500: Internal server error (ErrorResponse)

Usage
-----
These response dictionaries can be used in FastAPI endpoint definitions
to specify response models, descriptions, and examples
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
