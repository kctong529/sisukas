"""
config.py
=========

Environment and storage configuration for the Sisukas Filters API.

This module provides centralized configuration for:

1. Environment detection:
    - Loads environment variables from a .env file using python-dotenv.
    - Determines the current environment (SISUKAS_ENV), defaulting to "test".
      Only "prod" and "test" are valid; any other value raises an error.
2. Filter storage paths:
    - Selects folder name for storing filter JSON files based on environment:
        - "filters_prod" if ENV is "prod"
        - "filters_test" if ENV is "test"
    - Defines the full storage path (FILTERS_DIR)
      and ensures the directory exists.
3. FastAPI app configuration:
    - CORS origins (CORS_ORIGINS)
    - API metadata: title (API_TITLE), version (API_VERSION),
      and contact info (API_CONTACT)


Variables
---------
ENV : str
    Current environment, either "prod" or "test".
FILTERS_FOLDER_NAME : str
    Folder name for storing filter JSON files based on ENV.
BASE_DIR : pathlib.Path
    Base directory of the project (directory of this file's parent).
FILTERS_DIR : pathlib.Path
    Full path to the filter storage directory.
CORS_ORIGINS : list[str]
    Allowed origins for CORS middleware.
API_VERSION : str
    API version string.
API_TITLE : str
    API title for FastAPI documentation.
API_CONTACT : dict[str, str]
    Contact information for FastAPI documentation.


Usage
-----
Import this module wherever environment or storage configuration is needed:

    from core.config import FILTERS_DIR, ENV, CORS_ORIGINS, API_VERSION
"""

import os
from pathlib import Path as FsPath
from dotenv import load_dotenv

# Load the .env file
load_dotenv()

# --- Environment ---
ENV: str = os.getenv("SISUKAS_ENV", "test")  # default to test

if ENV == "prod":
    FILTERS_FOLDER_NAME = "filters_prod"
elif ENV == "test":
    FILTERS_FOLDER_NAME = "filters_test"
else:
    raise ValueError(f"Invalid SISUKAS_ENV='{ENV}'. Must be 'prod' or 'test'.")

BASE_DIR: FsPath = FsPath(__file__).parent.parent
FILTERS_DIR: FsPath = BASE_DIR / "storage" / FILTERS_FOLDER_NAME
FILTERS_DIR.mkdir(parents=True, exist_ok=True)

# --- FastAPI app configuration ---
CORS_ORIGINS: list[str] = [
    origin.strip() for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
]

API_VERSION = "0.2.0"
API_TITLE = "Sisukas Filters API"
API_CONTACT = {
    "name": "API Support",
    "email": "kichun.tong@aalto.fi"
}
