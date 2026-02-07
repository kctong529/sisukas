"""
routers/filters.py
==================

Filter persistence endpoints for the Sisukas application.

This router provides endpoints to save, retrieve, and delete filter
configurations used for course selection.

Key properties
--------------
- Filter configurations are stored as JSON payloads.
- Each configuration is identified by a SHA-256–derived hash ID.
- Identical payloads are deduplicated and return the same hash ID.
- All endpoints are deterministic and idempotent where applicable.
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
    "/api/filters",
    status_code=201,
    response_model=PostResponse,
    responses=POST_RESPONSES
)
async def save_filter(query: FilterQuery):
    """
    Save a new filter configuration or return an existing one

    If an identical configuration already exists, the existing hash ID
    is reused (idempotent behavior). Returns a unique hash identifier
    referencing the saved filter.
    """
    logger.info("Received request to create filter")

    # Serialize FilterQuery to JSON
    query_dict = query.model_dump(exclude_none=True)

    # Generate a hash ID, reusing existing hash if identical content
    full_hash, k, to_create = generate_unique_hash(query_dict)
    hash_id = full_hash[:k]

    # Only save if the file does not exist yet
    if to_create:
        save_filter_file(full_hash, k, query_dict)
        logger.info("Saved new filter %s in %s mode", hash_id, ENV)
    else:
        logger.info("Filter already exists with hash %s", hash_id)
    return PostResponse(hash_id=hash_id)


@router.get(
    "/api/filters/{hash_id}",
    response_model=GetResponse,
    responses=GET_RESPONSES
)
async def load_filter(hash_id: str = Depends(validate_hash_id)):
    """
    Retrieve a stored filter configuration by its hash ID

    Returns the full filter configuration if found,
    or 404 if not present in storage.
    """
    try:
        data = load_filter_file(hash_id)
    except Exception as e:
        logger.error(
            "Failed to load filter %s: %s", hash_id, e, exc_info=True)
        raise HTTPException(status_code=500,
                            detail="Internal storage error") from e

    if not data:
        raise HTTPException(status_code=404, detail="Filter not found")
    logger.info("Loaded filter %s from %s storage", hash_id, ENV)
    return GetResponse(**data)


@router.delete(
    "/api/filters/{hash_id}",
    response_model=DeleteResponse,
    responses=DELETE_RESPONSES
)
async def delete_filter(hash_id: str = Depends(validate_hash_id)):
    """
    Delete a stored filter configuration by its hash ID

    Returns a success message if deletion succeeds, or 404 if no filter
    exists with the provided hash ID.
    """
    try:
        deleted = delete_filter_file(hash_id)
    except Exception as e:
        logger.error("Failed to delete filter %s: %s",
                     hash_id, e, exc_info=True)
        raise HTTPException(status_code=500,
                            detail="Internal storage error") from e

    if not deleted:
        raise HTTPException(status_code=404, detail="Filter not found")

    logger.info("Deleted filter %s from %s storage", hash_id, ENV)
    return DeleteResponse(
        message="Filter deleted successfully",
        hash_id=hash_id)
