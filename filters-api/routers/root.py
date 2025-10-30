"""
root.py
=======

Root API Router for Sisukas Filters.

This module provides the root endpoint of the API, which returns basic
metadata about the service, environment information, storage statistics,
and a summary of available endpoints.

The root endpoint is typically used for health checks, API discovery, and
to provide clients with a quick overview of the service.
"""

from fastapi import APIRouter
from models.response_models import RootResponse
from utils.responses import ROOT_RESPONSES
from core.config import API_TITLE, API_VERSION, ENV

router = APIRouter()


@router.get(
    "/",
    response_model=RootResponse,
    responses=ROOT_RESPONSES
)
async def root():
    """
    Retrieve API metadata and environment details

    Returns
    -------
    RootResponse
        Contains:
        - service: API title
        - version: API version
        - environment: Current environment (e.g., development, production)
        - description: Brief description of the API
        - endpoints: Dictionary of available API endpoints
    """
    return RootResponse(
        service=API_TITLE,
        version=API_VERSION,
        environment=ENV,
        description="Save and retrieve filter configurations "
        "for course selection",
        endpoints={
            "save": "/api/filters",
            "load": "/api/filters/{hash_id}",
            "delete": "/api/filters/{hash_id}",
            "docs": "/docs"
        },
    )
