"""
models/filter_models.py
==================

Pydantic models for filter configuration input and validation.

This module defines:
- The structure of filter query payloads
- Validation helpers for hash IDs used in filter lookup and deletion

These models are shared across routers to keep request validation
consistent and centralized.
"""

import re
from typing import List, Annotated
from pydantic import BaseModel, Field
from fastapi import Path, HTTPException


# Shared regex for hash validation
HASH_PATTERN = r"^[a-f0-9]{16,64}$"


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
            "example": [
                {
                    "rules": [
                        {
                            "field": "period",
                            "relation": "is in",
                            "value": "2025-26 Period II"
                        },
                        {
                            "field": "enrollment",
                            "relation": "on",
                            "value": "2025-10-19"
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
                            "relation": "DSD24",
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


# ------------------------
# Hash validation dependency
# ------------------------


def validate_hash_id(
    hash_id: Annotated[str, Path(
        min_length=16,
        max_length=64,
        pattern=HASH_PATTERN,
        json_schema_extra={"example": "43de8e1e03d4a5e3"}
    )]
) -> str:
    """
    Validate that a given hash ID matches the required SHA-256 format

    Ensures the hash consists only of 16–64 lowercase hexadecimal characters.
    Used as a FastAPI dependency for path parameters.
    """
    if not re.fullmatch(HASH_PATTERN, hash_id):
        raise HTTPException(
            status_code=422,
            detail="Invalid hash format"
        )
    return hash_id
