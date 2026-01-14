"""
api/routers/root.py
===================

Root API Router for Sisu Wrapper.
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from core.config import API_TITLE, API_VERSION, ENV
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
        description="Lightweight wrapper for Aalto Sisu course data API",
        endpoints={
            "study_groups": {
                "method": "GET",
                "path": "/api/courses/study-groups",
                "description": "Fetch study groups for a course offering"
            },
            "batch_study_groups": {
                "method": "POST",
                "path": "/api/courses/batch/study-groups",
                "description": "Batch fetch study groups for multiple offerings"
            },
            "batch_offerings": {
                "method": "POST",
                "path": "/api/courses/batch/offerings",
                "description": "Batch fetch complete course offerings"
            },
            "docs": {
                "method": "GET",
                "path": "/docs",
                "description": "Interactive API documentation (Swagger UI)"
            }
        }
    )