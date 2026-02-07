"""
routers/root.py
==================

Root endpoint for API discovery.

This endpoint returns static, human-readable metadata about the service:
- API name and version
- Runtime environment
- Short service description
- List of available endpoints

Operational status and deployment metadata are exposed via /health instead.
"""

from fastapi import APIRouter
from models.response_models import RootResponse
from utils.responses import ROOT_RESPONSES
from core.config import (
    API_TITLE,
    API_VERSION,
    API_DESCRIPTION,
    API_ENDPOINTS,
    ENV,
)

router = APIRouter()


@router.get(
    "/",
    response_model=RootResponse,
    responses=ROOT_RESPONSES
)
async def root():
    """Get API metadata and available endpoints"""
    return RootResponse(
        service=API_TITLE,
        version=API_VERSION,
        environment=ENV,
        description=API_DESCRIPTION,
        endpoints=API_ENDPOINTS,
    )
