from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import logging

from sisu_wrapper.service import SisuService
from sisu_wrapper.client import SisuClient
from sisu_wrapper.models import StudyGroup

from core.config import (
    CORS_ORIGINS,
    API_TITLE,
    API_VERSION,
    API_CONTACT,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
