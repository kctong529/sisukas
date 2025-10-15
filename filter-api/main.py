"""
main.py - Sisukas Filters API

This FastAPI application provides endpoints to save and retrieve
filter configurations for course selection. Filter configurations are
stored with a hash identifier that can be used to share and load saved
filters.

A filter configuration consists of:
- Filter groups: Collections of rules combined with AND logic
- Must groups: Universal constraints that all courses must satisfy
- Alternative groups (is_must=False): Different acceptable patterns (OR logic)

Endpoints:
    POST /api/filters/save/
        Saves a filter configuration and returns a hash identifier.
        The filter can later be retrieved using this hash.

    GET /api/filters/{filter_hash}/
        Retrieves a previously saved filter configuration by its hash.
        Returns 404 if the hash is not found.

    GET /
        API information endpoint that returns service details and statistics.

Models:
    FilterRule
        Single atomic filter condition with:
        - field: The course attribute to filter
          (e.g., "code", "major", "period")
        - relation: Comparison method
          (e.g., "contains", "is", "overlaps", "after")
        - value: Value to compare against

    FilterGroup
        Group of rules combined with AND logic:
        - rules: List of FilterRule objects
        - is_must: Boolean flag
          (True for universal constraints, False for alternatives)

    FilterQuery
        Complete filter specification:
        - groups: List of FilterGroup objects

Usage:
    Run the application with FastAPI:
        fastapi dev main.py

    Example POST request body:
        {
          "groups": [
            {
              "rules": [
                {"field": "period",
                 "relation": "overlaps",
                 "value": "2025-26 Period II"},
                {"field": "enrollment",
                 "relation": "is_open",
                 "value": "today"}
              ],
              "is_must": true
            },
            {
              "rules": [{"field": "major",
                         "relation": "is",
                         "value": "DSD24"}],
              "is_must": false
            }
          ]
        }

    Response:
        {"hash": "a3f5d8e9c2b14f67"}

    Retrieve the saved filter:
        curl http://localhost:8000/api/filters/a3f5d8e9c2b14f67/
"""

import hashlib
from typing import List, Any, Dict
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


app = FastAPI(
    title="Sisukas Filters API",
    version="0.0.2",
    contact={
        "name": "API Support",
        "email": "kichun.tong@aalto.fi",
    }
)


# Pydantic model
class FilterRule(BaseModel):
    """Single atomic filter condition"""
    field: str
    relation: str
    value: Any

    model_config = {
        "json_schema_extra": {
            "examples": {
                "field": "code",
                "relation": "contains",
                "value": "CS"
            }
        }
    }


class FilterGroup(BaseModel):
    """Group of rules combined with AND logic"""
    rules: List[FilterRule]
    is_must: bool = False

    model_config = {
        "json_schema_extra": {
            "examples": {
                "rules": [
                    {
                        "field": "code",
                        "relation": "contains",
                        "value": "CS"
                    },
                    {
                        "field": "major",
                        "relation": "is",
                        "value": "DSD24"
                    },
                    {
                        "field": "startDate",
                        "relation": "after",
                        "value": "2025-10-10"
                    }
                ],
                "is_must": False
            }
        }
    }


class FilterQuery(BaseModel):
    """Complete filter specification"""
    groups: List[FilterGroup]

    model_config = {
        "json_schema_extra": {
            "examples": {
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
                    },
                ]
            }
        }
    }


# Simple storage (replace with database in production)
filter_storage: Dict[str, str] = {}


@app.post("/api/filters/save/")
def save_filter(query: FilterQuery):
    """Save a filter configuration and return its hash"""
    # Serialize to JSON
    query_json = query.model_dump_json(exclude_none=True)
    # Generate hash
    filter_hash = hashlib.sha256(query_json.encode()).hexdigest()[:16]
    # Store
    filter_storage[filter_hash] = query_json
    return {"hash": filter_hash}


@app.get("/api/filters/{filter_hash}/")
def load_filter(filter_hash: str):
    """Load a filter configuration by hash"""
    if filter_hash not in filter_storage:
        raise HTTPException(status_code=404, detail="Filter not found")

    query_json = filter_storage[filter_hash]
    # Parse the JSON string back to a Pydantic model
    query = FilterQuery.model_validate_json(query_json)
    return query  # FastAPI serializes this properly


@app.get("/")
async def root():
    """
    API information and health check endpoint.
    """
    return {
        "service": "Sisukas Filters API",
        "version": "0.0.2",
        "description":
            "Save and retrieve filter configurations for course selection",
        "endpoints": {
            "save": "/api/filters/save/",
            "load": "/api/filters/{hash}/",
            "docs": "/docs"
        },
        "stats": {
            "stored_filters": len(filter_storage)
        }
    }
