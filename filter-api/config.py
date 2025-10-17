"""
config.py

Environment and storage configuration for the Sisukas Filters API

This module handles:

1. Loading environment variables from a .env file using python-dotenv.
2. Determining the current environment (SISUKAS_ENV), defaulting to "test".
   Only the values "prod" and "test" are valid;
   any other value raises an error.
3. Selecting the appropriate folder name for storing filter JSON files
   based on the environment:
       - PROD_FILTERS_FOLDER if ENV is "prod"
       - TEST_FILTERS_FOLDER if ENV is "test"
4. Defining the full storage path (FILTERS_DIR) and creating the
   directory if it does not exist.
5. Providing FastAPI-specific configuration, including CORS origins,
   API title, version, and contact info.

Variables:
    ENV: str
        The current environment. Must be either "prod" or "test".
    FILTERS_FOLDER_NAME: str
        Folder name for storing filter JSON files, selected based on ENV.
    BASE_DIR: pathlib.Path
        Base directory of the project (directory of this file).
    FILTERS_DIR: pathlib.Path
        Full path to the filters storage directory. Directory is
        created if it does not exist.
    CORS_ORIGINS: list[str]
        List of allowed origins for CORS middleware.
    API_VERSION: str
        Version string of the API.
    API_TITLE: str
        API title for FastAPI docs.
    API_CONTACT: dict
        Contact information dictionary for FastAPI docs.

Usage:
    Import this module wherever storage path, environment info, or API
    configuration is needed. Example:

        from config import FILTERS_DIR, ENV, CORS_ORIGINS, API_VERSION
"""

import os
from pathlib import Path as FsPath
from dotenv import load_dotenv

# Load the .env file
load_dotenv()

# --- Environment ---
ENV = os.getenv("SISUKAS_ENV", "test")  # default to test

if ENV == "prod":
    FILTERS_FOLDER_NAME = "filters_prod"
elif ENV == "test":
    FILTERS_FOLDER_NAME = "filters_test"
else:
    raise ValueError(f"Invalid SISUKAS_ENV='{ENV}'. Must be 'prod' or 'test'.")

BASE_DIR = FsPath(__file__).parent
FILTERS_DIR = BASE_DIR / "storage" / FILTERS_FOLDER_NAME
FILTERS_DIR.mkdir(parents=True, exist_ok=True)

# --- FastAPI app configuration ---
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

API_VERSION = "0.1.0"
API_TITLE = "Sisukas Filters API"
API_CONTACT = {
    "name": "API Support",
    "email": "kichun.tong@aalto.fi"}
