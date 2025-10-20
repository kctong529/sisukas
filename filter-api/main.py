"""
Sisukas Filters API
===================

This FastAPI application provides endpoints to save, retrieve, and delete
filter configurations used for course selection in Sisukas.

Each filter configuration is stored as a JSON file identified by a unique
SHA-256 hash ID. Identical filters are deduplicated, so multiple submissions
of the same filter return the same hash. Users can save, share, and reuse
filter configurations using these hash IDs.


Filter Configuration Structure
------------------------------
- Filter groups: Collections of rules combined with AND logic
- Must groups: All rules must be satisfied for a course to match
- Alternative groups: At least one rule must be satisfied (OR logic)


Responses
---------
All endpoints return structured responses according to Pydantic models:

- PostResponse: Returned on filter creation with the generated hash_id
- GetResponse: Returned on successful filter retrieval
- DeleteResponse: Returned on successful deletion
- RootResponse: Returned by the root endpoint with API metadata
- ErrorResponse: Returned for validation errors, not found, or internal
  server errors. Includes a detail field describing the error


Endpoints
---------
- POST /api/filter
    Save a new filter configuration
    Returns 201 Created with PostResponse
    Possible error responses:
      - 422 Unprocessable Entity for invalid input
      - 500 Internal Server Error for unexpected failures

- GET /api/filter/{hash_id}
    Retrieve a saved filter configuration by hash_id
    Returns 200 OK with GetResponse
    Possible error responses:
      - 422 Unprocessable Entity for invalid hash format
      - 404 Not Found if no filter exists with the given hash
      - 500 Internal Server Error for unexpected failures

- DELETE /api/filter/{hash_id}
    Delete a saved filter configuration
    Returns 200 OK with DeleteResponse
    Possible error responses:
      - 422 Unprocessable Entity for invalid hash format
      - 404 Not Found if no filter exists with the given hash
      - 500 Internal Server Error for unexpected failures

- GET /
    Return API metadata, version, and storage statistics
    Returns 200 OK with RootResponse
    Possible error responses:
      - 500 Internal Server Error for unexpected failures
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError

from core.config import (
    CORS_ORIGINS,
    API_TITLE,
    API_VERSION,
    API_CONTACT,
)
from core.exceptions import (
    http_exception_handler,
    validation_exception_handler,
    unhandled_exception_handler
)
from routers import filters_router, root_router


# FastAPI app
app = FastAPI(title=API_TITLE, version=API_VERSION, contact=API_CONTACT)


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)


# Routers
app.include_router(filters_router)
app.include_router(root_router)
