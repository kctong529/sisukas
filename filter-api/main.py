"""
Sisukas Filters API
===================

This FastAPI application provides an API for saving, retrieving, and deleting
filter configurations used for course selection in Sisukas.

Each filter configuration is stored as a JSON file identified by a unique
SHA-256-based hash ID. This allows users to save, share, and reapply filter
criteria later using the same hash.

A filter configuration consists of:

- Filter groups: Collections of rules combined with AND logic
- Must groups: All must be satisfied for a course to match
- Alternative groups: At least one must be satisfied (OR logic)

Endpoints:

    POST /api/filter
        Save a new filter configuration. Returns a generated hash_id

    GET /api/filter/{hash_id}
        Retrieve a previously saved filter configuration by its hash_id
        Returns 404 if the filter is not found

    DELETE /api/filter/{hash_id}
        Delete a saved filter configuration. Returns a success message

    GET /
        Returns API metadata, version, and storage statistics

"""

import logging
import re
from typing import List, Annotated
from pydantic import BaseModel, Field
from fastapi import FastAPI, Path, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.requests import Request
from fastapi.exceptions import RequestValidationError

from config import (
    ENV, FILTERS_DIR, CORS_ORIGINS,
    API_TITLE, API_VERSION, API_CONTACT
)
from file_storage import (
    save_filter_file, load_filter_file,
    generate_unique_hash, delete_filter_file
)


logger = logging.getLogger('uvicorn.error')


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


@app.exception_handler(HTTPException)
async def http_exception_handler(
    request: Request,
    exc: HTTPException
):
    """Handles HTTPExceptions with consistent JSON output"""
    logger.warning(
        "%s error at %s: %s",
        exc.status_code,
        request.url.path,
        exc.detail
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError
):
    """Handles validation errors from Pydantic/FastAPI"""
    logger.warning(
        "422 validation error at %s: %s",
        request.url.path,
        exc.errors()
    )
    first_error = (
        exc.errors()[0]["msg"]
        if exc.errors()
        else "Invalid request data"
    )
    return JSONResponse(
        status_code=422,
        content={"detail": first_error},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request,
    exc: Exception
):
    """Catch-all handler for unexpected errors"""
    logger.exception(
        "Unhandled error at %s: %s",
        request.url.path,
        exc
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# ------------------------
# Pydantic models
# ------------------------

# Shared regex for hash validation
HASH_PATTERN = r"^[a-f0-9]{16,64}$"


class FilterRule(BaseModel):
    """Represents a single atomic filter condition for a course"""
    field: str = Field(
        min_length=1,
        max_length=20,
        description="Course attribute to filter on",
        json_schema_extra={"example": "code"}
    )
    relation: str = Field(
        min_length=2,
        max_length=15,
        description="Comparison operator (e.g. contains, overlaps, after)",
        json_schema_extra={"example": "contains"}
    )
    value: str = Field(
        min_length=1,
        max_length=100,
        description="Value to compare against. "
        "Format depends on the field type",
        json_schema_extra={"examples": ["CS", "2025-10-10", "en",
                                        "basic-studies", "DSD24"]}
    )


class FilterGroup(BaseModel):
    """Group of rules combined with AND logic"""
    rules: List[FilterRule] = Field(
        ...,
        description="Group of filter rules for course filtering"
    )
    is_must: bool = Field(
        default=False,
        description="Whether this is a must group or alternative group"
    )


class FilterQuery(BaseModel):
    """Complete filter configuration containing multiple groups"""
    groups: List[FilterGroup] = Field(
        ...,
        json_schema_extra={
            "example": [
                {
                    "rules": [
                        {
                            "field": "period",
                            "relation": "is",
                            "value": "2025-26 Period II"
                        },
                        {
                            "field": "enrollment",
                            "relation": "overlaps",
                            "value": "today"
                        }
                    ],
                    "is_must": True
                },
                {
                    "rules": [
                        {
                            "field": "code",
                            "relation": "contains",
                            "value": "CS"
                        }
                    ],
                    "is_must": False
                },
                {
                    "rules": [
                        {
                            "field": "major",
                            "relation": "is",
                            "value": "DSD24"
                        }
                    ],
                    "is_must": False
                },
                {
                    "rules": [
                        {
                            "field": "teacher",
                            "relation": "contains",
                            "value": "Milo"
                        }
                    ],
                    "is_must": False
                }
            ]
        }
    )


def validate_hash_id(
    hash_id: Annotated[str, Path(
        min_length=16,
        max_length=64,
        pattern=HASH_PATTERN,
        json_schema_extra={"example": "1c1ec50735361d70"}
    )]
) -> str:
    """
    Validate that a given hash ID matches the required SHA-256 format

    Ensures the hash consists only of 16–64 lowercase hexadecimal characters.
    Used as a FastAPI dependency for path parameters.
    """
    if not re.fullmatch(HASH_PATTERN, hash_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid hash format. "
            "Expected 16–64 lowercase hex characters."
        )
    return hash_id


# ------------------------
# Response models
# ------------------------


class PostResponse(BaseModel):
    """Response for successful filter creation"""
    hash_id: str = Field(
        min_length=16,
        max_length=64,
        pattern=HASH_PATTERN,
        description="Unique hash ID assigned to the saved filter",
        json_schema_extra={"example": "1c1ec50735361d70"}
    )


class GetResponse(FilterQuery):
    """Response for retrieving a saved filter configuration"""
    # Extends FilterQuery for semantics (Swagger treats it as distinct)


class DeleteResponse(BaseModel):
    """Response model for successful filter deletion"""
    message: str = Field(
        ...,
        description="Success message confirming filter deletion",
        json_schema_extra={"example": "Filter deleted successfully"}
    )
    hash_id: str = Field(
        pattern=HASH_PATTERN,
        description="Hash of the deleted filter",
        json_schema_extra={"example": "1c1ec50735361d70"}
    )


class RootResponse(BaseModel):
    """Metadata and service status"""
    service: str = Field(
        ...,
        json_schema_extra={"example": "Sisukas Filters API"})
    version: str = Field(
        ...,
        json_schema_extra={"example": "1.0.0"})
    environment: str = Field(
        ...,
        json_schema_extra={"example": "development"})
    description: str = Field(
        ...,
        json_schema_extra={
            "example": "Save and retrieve filter configurations"
        })
    endpoints: dict = Field(
        ...,
        json_schema_extra={
            "example": {
                "save": "/api/filter",
                "load": "/api/filter/{hash_id}",
                "delete": "/api/filter/{hash_id}",
                "docs": "/docs"
            }
        }
    )
    storage_dir: str = Field(
        ...,
        json_schema_extra={
            "example": "/data/filters"
        })
    stats: dict = Field(
        ...,
        json_schema_extra={
            "example": {
                "stored_filters": 42
            }}
    )


class ErrorResponse(BaseModel):
    """Standardized error response model"""
    detail: str = Field(
        ...,
        description="Human-readable error message",
        json_schema_extra={"example": "Filter not found"}
    )


# ------------------------
# Endpoint-specific responses
# ------------------------

POST_RESPONSES = {
    201: {
        "description": "Filter created successfully",
        "model": PostResponse,
        "content": {
            "application/json": {
                "example": {
                    "hash_id": "1c1ec50735361d70"}}}
    },
    422: {
        "description": "Invalid request",
        "model": ErrorResponse,
        "content": {
            "application/json": {
                "example": {
                    "detail": "Invalid request data"}}}
    },
    500: {
        "description": "Internal server error",
        "model": ErrorResponse,
        "content": {
            "application/json": {
                "example": {
                    "detail": "Internal server error"}}}
    },
}


def error_response(detail: str) -> dict:
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


GET_RESPONSES = {
    200: {"description": "Filter retrieved successfully",
          "model": GetResponse},
    422: error_response("Invalid hash format"),
    404: error_response("Filter not found"),
    500: error_response("Internal server error"),
}

DELETE_RESPONSES = {
    200: {
        "description": "Filter deleted successfully",
        "model": DeleteResponse,
        "content": {
            "application/json": {
                "example": {
                    "message": "Filter deleted successfully",
                    "hash_id": "1c1ec50735361d70"}}}
    },
    422: error_response("Invalid hash format"),
    404: error_response("Filter not found"),
    500: error_response("Internal server error"),
}

ROOT_RESPONSES = {
    200: {"description": "API metadata retrieved successfully",
          "model": RootResponse},
    500: error_response("Internal server error"),
}


# ------------------------
# API endpoints
# ------------------------
@app.post(
    "/api/filter",
    status_code=201,
    response_model=PostResponse,
    responses=POST_RESPONSES
)
async def save_filter(query: FilterQuery):
    """
    Save a filter configuration and generate a unique hash ID
    """
    logger.info("Received request to create filter")

    # Serialize FilterQuery to JSON
    query_dict = query.model_dump(exclude_none=True)

    # Generate a hash ID, reusing existing hash if identical content
    hash_id, to_create = generate_unique_hash(query_dict)

    # Only save if the file does not exist yet
    if to_create:
        save_filter_file(hash_id, query_dict)
        logger.info("Saved new filter %s in %s mode", hash_id, ENV)
    else:
        logger.info("Filter already exists with hash %s", hash_id)
    return PostResponse(hash_id=hash_id)


@app.get(
    "/api/filter/{hash_id}",
    response_model=GetResponse,
    responses=GET_RESPONSES
)
async def load_filter(hash_id: str = Depends(validate_hash_id)):
    """
    Retrieve a saved filter configuration by its hash ID
    """
    data = load_filter_file(hash_id)
    if not data:
        raise HTTPException(status_code=404, detail="Filter not found")
    logger.info("Loaded filter %s from %s storage", hash_id, ENV)
    return GetResponse(**data)


@app.delete(
    "/api/filter/{hash_id}",
    response_model=DeleteResponse,
    responses=DELETE_RESPONSES
)
async def delete_filter(hash_id: str = Depends(validate_hash_id)):
    """
    Delete a saved filter configuration
    """
    deleted = delete_filter_file(hash_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Filter not found")

    logger.info("Deleted filter %s from %s storage", hash_id, ENV)
    return DeleteResponse(
        message="Filter deleted successfully",
        hash_id=hash_id)


@app.get(
    "/",
    response_model=RootResponse,
    responses=ROOT_RESPONSES
)
async def root():
    """
    Return API metadata and basic health information
    """
    stored_count = sum(1 for _ in FILTERS_DIR.glob("*.json"))
    return RootResponse(
        service=API_TITLE,
        version=API_VERSION,
        environment=ENV,
        description="Save and retrieve filter configurations "
        "for course selection",
        endpoints={
            "save": "/api/filter",
            "load": "/api/filter/{hash_id}",
            "delete": "/api/filter/{hash_id}",
            "docs": "/docs"
        },
        storage_dir=str(FILTERS_DIR),
        stats={"stored_filters": stored_count},
    )
