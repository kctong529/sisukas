"""
filters.py
==========

API Router for managing filter configurations in the Sisukas application.

This module defines endpoints for saving, retrieving, and deleting filter
configurations used for course selection. Filters are stored as JSON files
with unique SHA-256-based hash IDs, allowing deduplication and easy sharing.


Endpoints
---------
- POST /api/filter
    Save a new filter configuration. Returns a unique hash ID.
- GET /api/filter/{hash_id}
    Retrieve a filter configuration by its hash ID.
- DELETE /api/filter/{hash_id}
    Delete a filter configuration by its hash ID.


Responses
---------
All endpoints use structured Pydantic response models and predefined
response dictionaries (POST_RESPONSES, GET_RESPONSES, DELETE_RESPONSES)
to standardize success and error responses, including:

- PostResponse, GetResponse, DeleteResponse for successful operations.
- ErrorResponse for validation errors, not found, or internal server errors.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from core.config import ENV
from models.filter_models import FilterQuery, validate_hash_id
from models.response_models import PostResponse, GetResponse, DeleteResponse
from storage.file_storage import (
    save_filter_file,
    load_filter_file,
    generate_unique_hash,
    delete_filter_file
)
from utils.responses import POST_RESPONSES, GET_RESPONSES, DELETE_RESPONSES


logger = logging.getLogger("uvicorn.error")
router = APIRouter()


# ------------------------
# API endpoints
# ------------------------


@router.post(
    "/api/filter",
    status_code=201,
    response_model=PostResponse,
    responses=POST_RESPONSES
)
async def save_filter(query: FilterQuery):
    """
    Save a filter configuration and generate a unique hash ID
    """
    logger.info("Received request to create filter")

    # Serialize FilterQuery to JSON
    query_dict = query.model_dump(exclude_none=True)

    # Generate a hash ID, reusing existing hash if identical content
    hash_id, to_create = generate_unique_hash(query_dict)

    # Only save if the file does not exist yet
    if to_create:
        save_filter_file(hash_id, query_dict)
        logger.info("Saved new filter %s in %s mode", hash_id, ENV)
    else:
        logger.info("Filter already exists with hash %s", hash_id)
    return PostResponse(hash_id=hash_id)


@router.get(
    "/api/filter/{hash_id}",
    response_model=GetResponse,
    responses=GET_RESPONSES
)
async def load_filter(hash_id: str = Depends(validate_hash_id)):
    """
    Retrieve a saved filter configuration by its hash ID
    """
    data = load_filter_file(hash_id)
    if not data:
        raise HTTPException(status_code=404, detail="Filter not found")
    logger.info("Loaded filter %s from %s storage", hash_id, ENV)
    return GetResponse(**data)


@router.delete(
    "/api/filter/{hash_id}",
    response_model=DeleteResponse,
    responses=DELETE_RESPONSES
)
async def delete_filter(hash_id: str = Depends(validate_hash_id)):
    """
    Delete a saved filter configuration
    """
    deleted = delete_filter_file(hash_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Filter not found")

    logger.info("Deleted filter %s from %s storage", hash_id, ENV)
    return DeleteResponse(
        message="Filter deleted successfully",
        hash_id=hash_id)
