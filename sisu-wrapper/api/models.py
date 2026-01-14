"""
api/models.py
=============

Shared Pydantic models for API responses.

This module contains models used across multiple routers and utilities
to avoid circular imports.
"""

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    """Standardized error response"""
    detail: str = Field(
        ...,
        description="Human-readable error message"
    )