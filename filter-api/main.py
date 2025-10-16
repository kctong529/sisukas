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
    POST /api/filters/save/
        Save a filter configuration. The server generates a hash ID for the
        configuration, which can be used to retrieve it later
        Returns the hash ID as JSON

    GET /api/filters/{hash_id}/
        Retrieve a previously saved filter configuration by its hash ID
        Returns 404 if the hash is not found
        The response contains the full filter structure (groups → rules)

    GET /
        Returns API metadata, including version, endpoints, and basic stats

Models:
    FilterRule
        Represents a single atomic filter condition
      Fields:
        - field: Course attribute to filter (e.g., "code", "major", "period")
        - relation: Comparison operator (e.g., "contains", "is", "after")
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
        curl http://localhost:8000/api/filters/a3f5d8e9c2b14f67/
"""

import hashlib
import logging
from typing import List, Dict, Annotated
from fastapi import FastAPI, Path, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError

logger = logging.getLogger('uvicorn.error')


app = FastAPI(
    title="Sisukas Filters API",
    version="0.0.3",
    contact={
        "name": "API Support",
        "email": "kichun.tong@aalto.fi",
    }
)


origins = [
    "http://localhost:5173",  # frontend URL
    "http://127.0.0.1:5173"
]


# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # allow GET, POST, PUT, DELETE, OPTIONS, etc.
    allow_headers=["*"],  # allow any headers
)


# ------------------------
# Pydantic models
# ------------------------
class FilterRule(BaseModel):
    """Represents a single atomic filter condition for a course"""
    field: str = Field(
        min_length=1,
        max_length=20,
        description="Course attribute to filter on (e.g. code, major, "
        "period)",
        example="code"
    )
    relation: str = Field(
        min_length=2,
        max_length=15,
        description="Comparison operator (e.g. contains, overlaps, after)",
        example="contains"
    )
    value: str = Field(
        min_length=1,
        max_length=100,
        description="Value to compare against. Format depends on the "
        "field type",
        examples=["CS", "2025-10-10", "en", "basic-studies", "DSD24"]
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
        example=[
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
        example="e1d4f1a3a3c5afc4"
    )


# ------------------------
# In-memory storage (replace with database in production)
# ------------------------
filter_storage: Dict[str, str] = {}


def hash_exists(candidate: str) -> bool:
    """Check if a hash already exists in the storage"""
    return candidate in filter_storage


# ------------------------
# API endpoints
# ------------------------
@app.post("/api/filters/save/", response_model=HashModel)
async def save_filter(query: FilterQuery):
    """
    Save a filter configuration and generate a unique hash ID.

    Identical filter configurations always produce the same hash ID,
    preventing duplicates. Returns the hash for later retrieval.
    """
    logger.info("Received request to create filter")

    # Serialize FilterQuery to JSON
    query_json = query.model_dump_json(exclude_none=True)

    # Generate SHA-256 hash and shorten to 16 characters
    hash_id = hashlib.sha256(query_json.encode()).hexdigest()[:16]
    logger.info("Generated hash %s", hash_id)

    if hash_exists(hash_id):
        logger.error("Hash %s already existed!", hash_id)
    else:
        logger.info("Saving new filter hash %s", hash_id)
        filter_storage[hash_id] = query_json

    return HashModel(hash_id=hash_id)


@app.get("/api/filters/{hash_id}/", response_model=FilterResponse)
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
    except ValidationError:
        raise HTTPException(status_code=400, detail="Invalid hash format")

    hash_value = validated.hash_id  # Extract validated string

    if hash_value not in filter_storage:
        raise HTTPException(status_code=404, detail="Filter not found")

    logger.info("Retrieved filter with hash %s", hash_id)
    query_json = filter_storage[hash_value]
    query = FilterResponse.model_validate_json(query_json)
    return query  # FastAPI serializes this properly


@app.get("/")
async def root():
    """
    API metadata and health check endpoint.

    Returns service name, version, endpoint paths, and basic filter
    storage statistics.
    """
    return {
        "service": "Sisukas Filters API",
        "version": "0.0.3",
        "description":
            "Save and retrieve filter configurations for course selection",
        "endpoints": {
            "save": "/api/filters/save/",
            "load": "/api/filters/{hash_id}/",
            "docs": "/docs"
        },
        "stats": {
            "stored_filters": len(filter_storage)
        }
    }
