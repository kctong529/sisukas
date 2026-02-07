"""
core/config.py
==================

Central configuration for the Sisukas Filters API.

This module defines:
- Runtime environment name (ENVIRONMENT)
- CORS allowlist (CORS_ORIGINS), with production hardening
- API metadata used by FastAPI docs (title/version/contact)
- Storage configuration (GCS bucket)

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
        return True

CORS_ORIGINS = _parse_csv(os.getenv("CORS_ORIGINS", ""))

if ENV == "production":
    CORS_ORIGINS = [o for o in CORS_ORIGINS if not _is_loopback(o)]

CORS_ORIGINS_EFFECTIVE = CORS_ORIGINS

GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME")
if not GCS_BUCKET_NAME:
    raise ValueError("Missing GCS_BUCKET_NAME environment variable.")

API_VERSION = "0.4.0"
API_TITLE = "Sisukas Filters API"
API_DESCRIPTION = (
    "Small persistence API for Sisukas filter configurations. "
    "Clients POST a filter JSON, receive a stable hash ID, and can later "
    "GET or DELETE the configuration by that hash. Identical payloads are "
    "deduplicated and return the same hash ID."
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
    "save_filter": {
        "method": "POST",
        "path": "/api/filters",
        "description": "Save a filter configuration (deduplicated by content hash)",
    },
    "load_filter": {
        "method": "GET",
        "path": "/api/filters/{hash_id}",
        "description": "Load a saved filter configuration by hash ID",
    },
    "delete_filter": {
        "method": "DELETE",
        "path": "/api/filters/{hash_id}",
        "description": "Delete a saved filter configuration by hash ID",
    },
    "docs": {
        "method": "GET",
        "path": "/docs",
        "description": "Interactive API documentation (Swagger UI)",
    },
}
