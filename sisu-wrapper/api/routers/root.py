"""
api/routers/root.py
===================

Root endpoint for API discovery.

Returns static API metadata and a human-readable list of available endpoints.
Operational status and deployment metadata live under /health.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from core.config import (
    API_TITLE,
    API_VERSION,
    API_DESCRIPTION,
    API_ENDPOINTS,
    ENV,
)
from models import ErrorResponse

router = APIRouter()


class RootResponse(BaseModel):
    """API metadata and service information"""
    service: str
    version: str
    environment: str
    description: str
    endpoints: dict


ROOT_RESPONSES = {
    200: {
        "description": "API metadata retrieved successfully",
        "model": RootResponse
    },
    500: {
        "description": "Internal server error",
        "model": ErrorResponse,
        "content": {
            "application/json": {
                "example": {"detail": "Internal server error"}
            }
        }
    }
}


@router.get("/", response_model=RootResponse, responses=ROOT_RESPONSES)
async def root():
    """Get API metadata and available endpoints"""
    return RootResponse(
        service=API_TITLE,
        version=API_VERSION,
        environment=ENV,
        description=API_DESCRIPTION,
        endpoints=API_ENDPOINTS,
    )