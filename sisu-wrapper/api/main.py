"""
api/main.py
===========

FastAPI application wiring for the Sisu Wrapper API.

Responsibilities
---------------
- Load environment variables from the repository-level .env for local dev.
  (Cloud Run should set env vars via deployment configuration instead.)
- Create the FastAPI app with metadata from core.config.
- Configure CORS using the effective allowlist from core.config.
- Register routers:
  - /        : API discovery/metadata (root router)
  - /health  : standardized health/build/runtime info (health router)
  - /api/... : course endpoints (courses router)
"""

import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parents[1]  # sisu-wrapper repository root
load_dotenv(ROOT / ".env")                  # local development convenience

from core.config import (
    CORS_ORIGINS,
    API_TITLE,
    API_VERSION,
    API_DESCRIPTION,
    API_CONTACT,
)

from routers import courses, root, health

# Configure logging
logger = logging.getLogger("uvicorn.error")

# Initialize FastAPI application
app = FastAPI(
    title=API_TITLE,
    version=API_VERSION,
    contact=API_CONTACT,
    description=API_DESCRIPTION,
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
app.include_router(health.router)
app.include_router(courses.router)