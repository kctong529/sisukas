"""
models/response_models.py
==================

Pydantic response models for the Sisukas Filters API.

This module defines structured response schemas used by API endpoints,
including:
- Successful operation responses (create, retrieve, delete)
- Root discovery response
- Standardized error responses

These models are documentation-facing and used to generate
consistent OpenAPI specifications.
"""

from pydantic import BaseModel, Field
from .filter_models import FilterQuery, HASH_PATTERN

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
        json_schema_extra={"example": "43de8e1e03d4a5e3"}
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
        json_schema_extra={"example": "43de8e1e03d4a5e3"}
    )


class RootResponse(BaseModel):
    """Metadata and service status for the root endpoint"""
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
                "save": "/api/filters",
                "load": "/api/filters/{hash_id}",
                "delete": "/api/filters/{hash_id}",
                "docs": "/docs"
            }
        }
    )


class ErrorResponse(BaseModel):
    """Standardized error response model"""
    detail: str = Field(
        ...,
        description="Human-readable error message",
        json_schema_extra={"example": "Filter not found"}
    )
