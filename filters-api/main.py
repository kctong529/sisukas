"""
main.py
==================

FastAPI application wiring for the Sisukas Filters API.

Responsibilities
---------------
- Load environment variables from the repository-level .env file for local
  development only (production should inject env vars via Cloud Run).
- Create the FastAPI application using metadata from core.config.
- Configure CORS using the effective allowlist.
- Register routers:
  - /        : API discovery and metadata
  - /health  : service health and build/runtime information
  - /api/... : filter persistence endpoints
"""

import logging
import pathlib
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError

ROOT = pathlib.Path(__file__).resolve().parents[0]
load_dotenv(ROOT / ".env")

from core.config import (
    CORS_ORIGINS,
    API_TITLE,
    API_VERSION,
    API_DESCRIPTION,
    API_CONTACT,
)
from core.exceptions import (
    http_exception_handler,
    validation_exception_handler,
    unhandled_exception_handler
)
from routers import filters, root, health

# Configure logging
logger = logging.getLogger("uvicorn.error")


# FastAPI app
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


# Exception handlers
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)


# Routers
app.include_router(root.router)
app.include_router(health.router)
app.include_router(filters.router)
