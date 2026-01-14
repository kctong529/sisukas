"""
api/core/config.py
==================

Environment and application configuration for the Sisu Wrapper API.

This module provides centralized configuration for:

1. Environment detection:
    - Loads environment variables from a .env file using python-dotenv.
    - Determines the current environment (SISUKAS_ENV), defaulting to "test".

2. FastAPI app configuration:
    - CORS origins (CORS_ORIGINS)
    - API metadata: title (API_TITLE), version (API_VERSION),
      and contact info (API_CONTACT)

Variables
---------
ENV : str
    Current environment (e.g., "prod", "test", "development").
    Defaults to "test" if SISUKAS_ENV is not set.

CORS_ORIGINS : list[str]
    List of allowed origins for CORS middleware.
    Loaded from CORS_ORIGINS environment variable, or uses sensible defaults
    for local development and staging deployments.

API_VERSION : str
    Semantic version string of the API.

API_TITLE : str
    Display title for the API in FastAPI documentation (Swagger UI).

API_CONTACT : dict[str, str]
    Contact information displayed in FastAPI documentation.
    Contains 'name' and 'email' fields.

Usage
-----
Import this module wherever configuration is needed:

    from core.config import ENV, CORS_ORIGINS, API_VERSION, API_TITLE
"""

import os
from dotenv import load_dotenv

# Load the .env file
load_dotenv()

# ========================
# Environment configuration
# ========================

ENV = os.getenv("SISUKAS_ENV", "test")

# ========================
# FastAPI app configuration
# ========================

CORS_ORIGINS: list[str] = [
    origin.strip() for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
        ",https://sisukas.fly.dev,https://sisukas.eu"
        ",https://sisukas-test.fly.dev"
        ",https://fuzzy-test.sisukas.eu"
        ",https://localhost:5173"
    ).split(",")
]

API_VERSION = "0.2.0"
API_TITLE = "Sisu Wrapper API"
API_CONTACT = {
    "name": "API Support",
    "email": "kichun.tong@aalto.fi"
}