"""
response_models.py
==================

Pydantic models defining standardized API responses for Sisukas Filters

This module provides response schemas for all endpoints, including:

- Success responses:
    - PostResponse: Returned when a filter is successfully created
    - GetResponse: Returned when a filter is retrieved
    - DeleteResponse: Returned when a filter is deleted
    - RootResponse: Returned by the root endpoint with API metadata
- Error responses:
    - ErrorResponse: Standardized model for validation errors, not found,
      or internal server errors

These models are used in FastAPI endpoints to generate structured JSON
responses and OpenAPI/Swagger documentation.
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
