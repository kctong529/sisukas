"""
api/models.py
=============

Shared Pydantic models used across routers.

This module is intentionally small and import-safe to avoid circular imports
between routers and utility modules.
"""

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    """Standardized error response"""
    detail: str = Field(
        ...,
        description="Human-readable error message"
    )