"""
api/main.py
===========

FastAPI application for the Sisu Wrapper API.

This module sets up the FastAPI application with routers for accessing
course data from the Aalto University Sisu API.

The API provides endpoints for:
- Fetching study groups for course offerings
- Batch fetching multiple study groups
- Batch fetching complete course offerings
- Health checks and API metadata

Routers
-------
- routers.courses: Endpoints for course and study group operations
- routers.root: Root endpoint with API metadata and service information
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import (
    CORS_ORIGINS,
    API_TITLE,
    API_VERSION,
    API_CONTACT,
)
from routers import courses, root

# Configure logging
logger = logging.getLogger("uvicorn.error")

# Initialize FastAPI application
app = FastAPI(
    title=API_TITLE,
    version=API_VERSION,
    contact=API_CONTACT,
    description="Lightweight API for fetching course data from Aalto Sisu"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(root.router)
app.include_router(courses.router)