"""
storage/file_storage.py
==================

Storage backend for filter configurations.

This module handles:
- Persisting filter configurations to storage
- Loading stored configurations by hash ID
- Deduplication based on full-content hashing
- Deletion of stored configurations

The storage layer is intentionally isolated so the API layer can
map storage errors cleanly to HTTP responses.
"""

import json
import hashlib
from functools import lru_cache
from typing import Optional, Callable, Tuple, Dict, Any
from google.cloud import storage
from google.auth import exceptions as auth_exceptions
from google.api_core.exceptions import GoogleAPIError
from google.api_core.exceptions import NotFound, PreconditionFailed
from core.config import GCS_BUCKET_NAME
from core.exceptions import logger


FILTER_SUFFIX = ".json"


@lru_cache
def get_bucket() -> storage.Bucket:
    """
    Retrieve and cache the Google Cloud Storage bucket

    This function initializes the GCS client and returns the configured
    bucket specified by the environment variable GCS_BUCKET_NAME.
    The result is cached to avoid redundant client initialization
    and network overhead.
    """

    if not GCS_BUCKET_NAME:
        raise ValueError(
            "GCS_BUCKET_NAME environment variable must be set")

    try:
        client = storage.Client()
        bucket = client.bucket(GCS_BUCKET_NAME)
        logger.debug("Using GCS bucket '%s'", GCS_BUCKET_NAME)
        return bucket
    except auth_exceptions.DefaultCredentialsError as e:
        logger.error(
            "Failed to authenticate with GCS: %s", e, exc_info=True)
        raise


def _blob_name(hash_id: str) -> str:
    """Return the standardized blob name for a given hash ID."""
    return f"{hash_id}{FILTER_SUFFIX}"


def save_filter_file(
    full_sha: str,
    k: int,
    data: dict[str, Any]
) -> None:
    """Save a filter configuration as a JSON file in GCS"""
    bucket = get_bucket()
    hash_id = full_sha[:k]
    blob = bucket.blob(_blob_name(hash_id))
    blob.metadata = {"sha256": full_sha}

    try:
        blob.upload_from_string(
            json.dumps(data),
            content_type="application/json",
            if_generation_match=0
        )
        logger.info("Uploaded new filter blob: %s", _blob_name(hash_id))
    except PreconditionFailed:
        logger.info(
            "Blob %s already exists, skipping upload",
            _blob_name(hash_id)
        )


@lru_cache(maxsize=256)
def load_filter_file(hash_id: str) -> Optional[Dict[str, Any]]:
    """Load a filter configuration from GCS"""
    bucket = get_bucket()
    blob = bucket.blob(_blob_name(hash_id))
    try:
        content = blob.download_as_bytes()
    except NotFound:
        logger.warning(
            "Blob %s not found in bucket '%s'",
            _blob_name(hash_id),
            GCS_BUCKET_NAME)
        return None
    return json.loads(content)


def delete_filter_file(hash_id: str) -> bool:
    """Delete a filter file by its hash ID from GCS"""
    bucket = get_bucket()
    blob = bucket.blob(_blob_name(hash_id))
    if not blob.exists():
        logger.warning(
            "Blob %s not found, skipping delete", _blob_name(hash_id))
        return False

    try:
        blob.delete()
        logger.info("Deleted blob: %s", _blob_name(hash_id))
        return True
    except GoogleAPIError as e:
        logger.error(
            "Failed to delete blob %s: %s",
            _blob_name(hash_id), e, exc_info=True)
        raise RuntimeError(f"Failed to delete filter {hash_id}") from e


def generate_unique_hash(
    content: Dict[str, Any],
    hash_func: Callable = hashlib.sha256,
    min_length: int = 16,
    max_length: int = 64
) -> Tuple[str, int, bool]:
    """
    Generate a unique, collision-resistant hash ID for filter config

    The hash is based on a canonical JSON representation of the content.
    If a matching filter already exists, the same hash ID is reused.

    Returns
    -------
    Tuple[str, int, bool]
        (full_hash, prefix_length, is_new)
    """
    bucket = get_bucket()
    # Canonical JSON string
    content_json = json.dumps(
        content, separators=(",", ":"), sort_keys=True)

    # Compute full SHA-256 hash
    full_hash = hash_func(content_json.encode()).hexdigest()
    k = min_length

    while k <= max_length:
        candidate = full_hash[:k]
        blob = bucket.blob(_blob_name(candidate))

        if not blob.exists():
            return full_hash, k, True

        blob.reload()
        if (blob.metadata or {}).get("sha256") == full_hash:
            return full_hash, k, False

        # Collision with different content -> extend hash
        logger.warning(
            "Collision detected for id %s, extending...", candidate
        )
        k += 1

    raise RuntimeError(
        "Hash collision could not be resolved within max_length")
