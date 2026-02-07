"""
api/core/config.py
==================

Central configuration for the Sisu Wrapper API.

This module defines:
- Runtime environment name (ENVIRONMENT)
- CORS allowlist (CORS_ORIGINS), with production hardening
- API metadata used by FastAPI docs (title/version/contact)

Conventions
-----------
- ENVIRONMENT controls runtime mode (e.g. development, test, production).
- CORS_ORIGINS is read from the environment when provided.
  If missing, defaults are local-dev friendly.
- In production, loopback origins (localhost/127.0.0.1/::1) are always dropped
  even if misconfigured, to prevent accidentally allowing local dev origins.
"""

import os
from urllib.parse import urlparse

ENV = os.getenv("ENVIRONMENT", "development")

def _parse_csv(v: str) -> list[str]:
    return [s.strip() for s in v.split(",") if s.strip()]

def _is_loopback(origin: str) -> bool:
    try:
        host = urlparse(origin).hostname
        return host in ("localhost", "127.0.0.1", "::1")
    except Exception:
        # Treat invalid origins as unsafe so they don't get allowed silently.
        return True

# Raw allowlist (default is local-dev friendly; Cloud Run should set CORS_ORIGINS explicitly)
CORS_ORIGINS: list[str] = _parse_csv(os.getenv("CORS_ORIGINS", ""))

# Harden production: never allow loopback origins
if ENV == "production":
    CORS_ORIGINS = [o for o in CORS_ORIGINS if not _is_loopback(o)]

# Exposed for /health and debugging (matches what CORSMiddleware enforces)
CORS_ORIGINS_EFFECTIVE = CORS_ORIGINS

API_VERSION = "0.4.1"
API_TITLE = "Sisu Wrapper API"

API_DESCRIPTION = (
    "Lightweight, read-only wrapper around Aalto University's Sisu system. "
    "Provides stable endpoints for resolving course offerings and study groups "
    "used by Sisukas and related tooling."
)

API_CONTACT = {
    "name": "API Support",
    "email": "kichun.tong@aalto.fi"
}

API_ENDPOINTS = {
    "health": {
        "method": "GET",
        "path": "/health",
        "description": "Service health, build metadata, and runtime info",
    },
    "study_groups": {
        "method": "GET",
        "path": "/api/courses/study-groups",
        "description": "Fetch study groups for a course offering",
    },
    "batch_study_groups": {
        "method": "POST",
        "path": "/api/courses/batch/study-groups",
        "description": "Batch fetch study groups for multiple offerings",
    },
    "batch_offerings": {
        "method": "POST",
        "path": "/api/courses/batch/offerings",
        "description": "Batch fetch complete course offerings",
    },
    "docs": {
        "method": "GET",
        "path": "/docs",
        "description": "Interactive API documentation (Swagger UI)",
    },
}
