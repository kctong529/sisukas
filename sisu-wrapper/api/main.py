from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import logging
from pydantic import BaseModel

from sisu_wrapper.service import SisuService
from sisu_wrapper.client import SisuClient
from sisu_wrapper.models import StudyGroup, CourseOffering

from core.config import (
    CORS_ORIGINS,
    API_TITLE,
    API_VERSION,
    API_CONTACT,
)

logger = logging.getLogger("uvicorn.error")

app = FastAPI(title=API_TITLE, version=API_VERSION, contact=API_CONTACT)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


client = SisuClient()
service = SisuService(client=client)


# ============ REQUEST MODELS ============

class CourseOfferingRequest(BaseModel):
    """Request model for a single course offering"""
    course_unit_id: str
    offering_id: str


class StudyGroupRequest(BaseModel):
    """Request model for fetching study groups"""
    course_unit_id: str
    course_offering_id: str


class BatchCourseOfferingRequest(BaseModel):
    """Batch request for multiple course offerings"""
    requests: List[CourseOfferingRequest]


class BatchStudyGroupRequest(BaseModel):
    """Batch request for multiple study groups"""
    requests: List[StudyGroupRequest]


# ============ SINGLE ENDPOINTS ============

@app.get("/study-groups", response_model=List[StudyGroup])
def get_study_groups(
    course_unit_id: str = Query(...,
        description="The ID of the course unit in Sisu"),
    course_offering_id: str = Query(...,
        description="The ID of the specific course offering")
):
    """
    Fetch study groups for a given course offering.
    """
    try:
        groups = service.fetch_study_groups(course_unit_id, course_offering_id)
        return groups
    except Exception as e:
        logger.error("Error fetching study groups: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
def root():
    return {"status": "ok"}


# ============ BATCH ENDPOINTS ============

@app.post("/batch/study-groups")
def batch_get_study_groups(body: BatchStudyGroupRequest):
    """
    Fetch study groups for multiple course offerings in a single request.

    Request body example:
    ```json
    {
        "requests": [
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
    ```
    
    Returns:
    ```json
    {
        "unit-1:offering-1": [...],
        "unit-2:offering-2": [...]
    }
    ```
    """
    try:
        batch_requests = [
            (req.course_unit_id, req.course_offering_id)
            for req in body.requests
        ]
        results = service.fetch_study_groups_batch(batch_requests)

        # Transform tuple keys to string keys for JSON serialization
        return {
            f"{k[0]}:{k[1]}": v for k, v in results.items()
        }
    except Exception as e:
        logger.error("Error in batch study groups request: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/batch/course-offerings")
def batch_get_course_offerings(body: BatchCourseOfferingRequest):
    """
    Fetch complete course offerings for multiple course/offering pairs.

    Request body example:
    ```json
    {
        "requests": [
            {
                "course_unit_id": "aalto-OPINKOHD-1125839311-20210801",
                "offering_id": "aalto-CUR-206690-3122470"
            },
            {
                "course_unit_id": "otm-e737f80e-5bc4-4a34-9524-8243d7f9f14a",
                "course_offering_id": "aalto-CUR-206050-3121830"
            }
        ]
    }
    ```

    Returns:
    ```json
    {
        "unit-1:offering-1": { course offering data },
        "unit-2:offering-2": { course offering data }
    }
    ```
    """
    try:
        batch_requests = [
            (req.course_unit_id, req.offering_id)
            for req in body.requests
        ]
        results = service.fetch_course_offerings_batch(batch_requests)

        # Transform tuple keys to string keys for JSON serialization
        return {
            f"{k[0]}:{k[1]}": v for k, v in results.items()
        }
    except Exception as e:
        logger.error("Error in batch course offerings request: %s", e)
        raise HTTPException(status_code=500, detail=str(e))