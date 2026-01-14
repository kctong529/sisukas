"""
api/routers/courses.py
======================

API Router for Sisu course data endpoints.

This module defines endpoints for accessing course offerings, study groups,
and related data from the Aalto University Sisu API.
"""

import logging
from typing import List, Dict
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, Field

from sisu_wrapper.service import SisuService
from sisu_wrapper.client import SisuClient
from sisu_wrapper.models import StudyGroup, CourseOffering
from sisu_wrapper.exceptions import (
    SisuAPIError, SisuNotFoundError, SisuTimeoutError
)
from models import ErrorResponse
from utils.responses import (
    STUDY_GROUPS_RESPONSES,
    BATCH_STUDY_GROUPS_RESPONSES,
    BATCH_OFFERINGS_RESPONSES
)

logger = logging.getLogger("uvicorn.error")
router = APIRouter()

# Initialize client and service (singleton)
_client = SisuClient()
_service = SisuService(client=_client)


# ============ REQUEST MODELS ============

class StudyGroupRequest(BaseModel):
    """Request model for fetching study groups"""
    course_unit_id: str = Field(
        ...,
        min_length=1,
        description="The ID of the course unit in Sisu",
        json_schema_extra={"example": "aalto-OPINKOHD-1125839311-20210801"}
    )
    course_offering_id: str = Field(
        ...,
        min_length=1,
        description="The ID of the specific course offering",
        json_schema_extra={"example": "aalto-CUR-206690-3122470"}
    )


class CourseOfferingRequest(BaseModel):
    """Request model for a single course offering"""
    course_unit_id: str = Field(
        ...,
        min_length=1,
        description="The ID of the course unit in Sisu",
        json_schema_extra={"example": "aalto-OPINKOHD-1125839311-20210801"}
    )
    offering_id: str = Field(
        ...,
        min_length=1,
        description="The ID of the course offering",
        json_schema_extra={"example": "aalto-CUR-206690-3122470"}
    )


class BatchStudyGroupsRequest(BaseModel):
    """Batch request for multiple study groups"""
    requests: List[StudyGroupRequest] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="List of study group fetch requests (max 100)",
        json_schema_extra={
            "example": [
                {
                    "course_unit_id": "aalto-OPINKOHD-1125839311-20210801",
                    "course_offering_id": "aalto-CUR-206690-3122470"
                },
                {
                    "course_unit_id": "otm-e737f80e-5bc4-4a34-9524-8243d7f9f14a",
                    "course_offering_id": "aalto-CUR-206050-3121830"
                }
            ]
        }
    )


class BatchOfferingsRequest(BaseModel):
    """Batch request for multiple course offerings"""
    requests: List[CourseOfferingRequest] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="List of course offering fetch requests (max 100)",
        json_schema_extra={
            "example": [
                {
                    "course_unit_id": "aalto-OPINKOHD-1125839311-20210801",
                    "offering_id": "aalto-CUR-206690-3122470"
                },
                {
                    "course_unit_id": "otm-e737f80e-5bc4-4a34-9524-8243d7f9f14a",
                    "offering_id": "aalto-CUR-206050-3121830"
                }
            ]
        }
    )


# ============ RESPONSE MODELS ============

class StudyGroupsResponse(BaseModel):
    """Response containing study groups for a course offering"""
    course_unit_id: str
    course_offering_id: str
    study_groups: List[StudyGroup]


class BatchStudyGroupsResponse(BaseModel):
    """Response for batch study groups fetch"""
    results: Dict[str, List[StudyGroup]] = Field(
        ...,
        description="Mapping of 'unit_id:offering_id' to study groups"
    )
    total_requests: int


class BatchOfferingsResponse(BaseModel):
    """Response for batch course offerings fetch"""
    results: Dict[str, CourseOffering] = Field(
        ...,
        description="Mapping of 'unit_id:offering_id' to course offerings"
    )
    total_requests: int


# ============ API ENDPOINTS ============

@router.get(
    "/api/courses/study-groups",
    response_model=StudyGroupsResponse,
    responses=STUDY_GROUPS_RESPONSES
)
async def get_study_groups(
    course_unit_id: str = Query(
        ...,
        min_length=1,
        description="The ID of the course unit in Sisu"
    ),
    course_offering_id: str = Query(
        ...,
        min_length=1,
        description="The ID of the specific course offering"
    )
):
    """Fetch study groups for a course offering"""
    try:
        groups = _service.fetch_study_groups(course_unit_id, course_offering_id)
        return StudyGroupsResponse(
            course_unit_id=course_unit_id,
            course_offering_id=course_offering_id,
            study_groups=groups
        )
    except SisuNotFoundError as e:
        logger.warning("Course not found: %s", e)
        raise HTTPException(status_code=404, detail="Course not found") from e
    except SisuTimeoutError as e:
        logger.error("Sisu API timeout: %s", e)
        raise HTTPException(status_code=504, detail="Sisu API timeout") from e
    except SisuAPIError as e:
        logger.error("Sisu API error: %s", e)
        raise HTTPException(status_code=502, detail="Sisu API unavailable") from e
    except Exception as e:
        logger.exception("Unexpected error fetching study groups")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.post(
    "/api/courses/batch/study-groups",
    status_code=200,
    response_model=BatchStudyGroupsResponse,
    responses=BATCH_STUDY_GROUPS_RESPONSES
)
async def batch_get_study_groups(body: BatchStudyGroupsRequest):
    """Batch fetch study groups for multiple course offerings"""
    try:
        batch_requests = [
            (req.course_unit_id, req.course_offering_id)
            for req in body.requests
        ]
        results = _service.fetch_study_groups_batch(batch_requests)

        return BatchStudyGroupsResponse(
            results={
                f"{k[0]}:{k[1]}": v for k, v in results.items()
            },
            total_requests=len(body.requests)
        )
    except Exception as e:
        logger.exception("Error in batch study groups request")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.post(
    "/api/courses/batch/offerings",
    status_code=200,
    response_model=BatchOfferingsResponse,
    responses=BATCH_OFFERINGS_RESPONSES
)
async def batch_get_course_offerings(body: BatchOfferingsRequest):
    """Batch fetch complete course offerings"""
    try:
        batch_requests = [
            (req.course_unit_id, req.offering_id)
            for req in body.requests
        ]
        results = _service.fetch_course_offerings_batch(batch_requests)

        return BatchOfferingsResponse(
            results={
                f"{k[0]}:{k[1]}": v for k, v in results.items() if v is not None
            },
            total_requests=len(body.requests)
        )
    except Exception as e:
        logger.exception("Error in batch course offerings request")
        raise HTTPException(status_code=500, detail="Internal server error") from e