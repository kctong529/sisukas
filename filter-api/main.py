"""
main.py - Sisukas Filters API

This FastAPI application provides endpoints to save and retrieve
filter configurations for course selection. Filter configurations are
stored using a SHA-256-based hash identifier, which can be used to
share and later retrieve the saved filters.

A filter configuration consists of:
- Filter groups: Collections of rules combined with AND logic
- Must groups: Groups marked as is_must=True, which all courses must satisfy
- Alternative groups: Groups marked as is_must=False, representing acceptable
  alternatives (OR logic between alternative groups)

Endpoints:
    POST /api/filter
        Save a filter configuration. The server generates a hash ID for the
        configuration, which can be used to retrieve it later
        Returns the hash ID as JSON

    GET /api/filter/{hash_id}
        Retrieve a previously saved filter configuration by its hash ID
        Returns 404 if the hash is not found
        The response contains the full filter structure (groups → rules)

    GET /
        Returns API metadata, including version, endpoints, and basic stats

Models:
    FilterRule
        Represents a single atomic filter condition
      Fields:
        - field: Course attribute to filter (e.g. "code", "major", "period")
        - relation: Comparison operator (e.g. "contains", "is", "after")
        - value: Value to compare against (string representation)

    FilterGroup
        Represents a group of rules combined with AND logic
      Fields:
        - rules: List of FilterRule objects
        - is_must: Boolean indicating if all courses must satisfy this group

    FilterQuery
        Complete filter configuration for a query
      Fields:
        - groups: List of FilterGroup objects

    HashModel
        Response model for saving a filter
      Fields:
        - hash_id: SHA-256-based identifier for the saved filter

Usage:
    Run the application with FastAPI:
        fastapi dev main.py

    Example POST request body:
        {
          "groups": [
            {
              "rules": [
                {
                  "field": "period",
                  "relation": "overlaps",
                  "value": "2025-26 Period II"
                },
                {
                  "field": "enrollment",
                  "relation": "is",
                  "value": "today"
                }
              ],
              "is_must": true
            },
            {
              "rules": [
                {
                  "field": "major",
                  "relation": "is",
                  "value": "DSD24"
                }
              ],
              "is_must": false
            }
          ]
        }

    Example response:
        {"hash_id": "a3f5d8e9c2b14f67"}

    Retrieve the saved filter:
        curl http://localhost:8000/api/filter/a3f5d8e9c2b14f67/
"""

import logging
from typing import List, Annotated
from pydantic import BaseModel, Field, ValidationError
from fastapi import FastAPI, Path, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from config import ENV, FILTERS_DIR, CORS_ORIGINS
from config import API_TITLE, API_VERSION, API_CONTACT
from file_storage import save_filter_file, load_filter_file
from file_storage import generate_unique_hash, delete_filter_file


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


# ------------------------
# Pydantic models
# ------------------------
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
            "example": {
                "groups": [
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
        }
    )


class FilterResponse(FilterQuery):
    pass


class HashModel(BaseModel):
    """Response model for returning a hash identifier of a saved filter"""
    hash_id: str = Field(
        min_length=16,
        max_length=64,
        pattern="^[a-f0-9]{16,64}$",
        description="SHA-256-based hash ID for the saved filter "
        "configuration",
        json_schema_extra={"example": "e1d4f1a3a3c5afc4"}
    )


# ------------------------
# API endpoints
# ------------------------
@app.post("/api/filter", response_model=HashModel)
async def save_filter(query: FilterQuery):
    """
    Save a filter configuration and generate a unique hash ID.

    The filter configuration is serialized to JSON and hashed using SHA-256.
    The initial hash ID is the first 16 characters of the SHA-256 hash.
    If a collision with an existing hash occurs, the hash is extended
    character by character until it becomes unique.
    A RuntimeError is raised if the hash cannot be made unique within
    64 characters (extremely unlikely).
    Identical filter configurations will always generate the same hash
    within the current runtime, unless filters are deleted.
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
    return HashModel(hash_id=hash_id)


@app.get("/api/filter/{hash_id}", response_model=FilterResponse)
async def load_filter(
    hash_id: Annotated[str, Path(
        min_length=16,
        max_length=64,
        pattern="^[a-f0-9]{16,64}$",
        examples=["e1d4f1a3a3c5afc4"])]
) -> FilterResponse:
    """
    Retrieve a filter configuration by its hash ID.

    Returns the complete filter specification (groups and rules).
    Returns 404 if no filter is found for the given hash.
    """
    try:
        validated = HashModel.model_validate({"hash_id": hash_id})
    except ValidationError as e:
        raise HTTPException(status_code=400,
                            detail="Invalid hash format") from e

    hash_value = validated.hash_id  # Extract validated string
    data = load_filter_file(hash_value)
    if not data:
        raise HTTPException(status_code=404, detail="Filter not found")

    logger.info("Loaded filter %s from %s storage", hash_id, ENV)
    return FilterResponse(**data)


@app.delete("/api/filter/{hash_id}")
async def delete_filter(
    hash_id: Annotated[str, Path(
        min_length=16,
        max_length=64,
        pattern="^[a-f0-9]{16,64}$",
        examples=["e1d4f1a3a3c5afc4"])]
) -> dict:
    """
    Delete a filter configuration by its hash ID.

    Returns a success message if the filter was deleted.
    Returns 404 if no filter is found for the given hash.
    """
    try:
        validated = HashModel.model_validate({"hash_id": hash_id})
    except ValidationError as e:
        raise HTTPException(status_code=400,
                            detail="Invalid hash format") from e

    hash_value = validated.hash_id
    deleted = delete_filter_file(hash_value)

    if not deleted:
        raise HTTPException(status_code=404, detail="Filter not found")

    logger.info("Deleted filter %s from %s storage", hash_id, ENV)
    return {
        "message": "Filter deleted successfully",
        "hash_id": hash_value
    }


@app.get("/")
async def root():
    """
    API metadata and health check endpoint.

    Returns service name, version, endpoint paths, and basic filter
    storage statistics.
    """
    stored_count = sum(1 for _ in FILTERS_DIR.glob("*.json"))
    return {
        "service": API_TITLE,
        "version": API_VERSION,
        "environment": ENV,
        "description":
            "Save and retrieve filter configurations for course selection",
        "endpoints": {
            "save": "/api/filter",
            "load": "/api/filter/{hash_id}",
            "delete": "/api/filter/{hash_id}",
            "docs": "/docs"
        },
        "storage_dir": str(FILTERS_DIR),
        "stats": {"stored_filters": stored_count},
    }
