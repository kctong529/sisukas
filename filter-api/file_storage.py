"""
file_storage.py

Utility functions for storing and retrieving filter configurations
as JSON files in a configurable storage directory. This module provides:

Usage:
    This module is intended to be used by the FastAPI filter endpoints to
    save and retrieve filter configurations in a structured and idempotent way.
    Example workflow:
        - Generate a hash for a filter dict with generate_unique_hash()
        - Save it using save_filter_file() if new
        - Load it later using load_filter_file() or read_file_content()
"""

import json
import hashlib
from typing import Optional, Callable, Tuple
from config import FILTERS_DIR


def save_filter_file(hash_id: str, data: dict) -> None:
    """Save filter JSON to a file in the configured storage folder"""
    file_path = FILTERS_DIR / f"{hash_id}.json"
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except (IOError, OSError) as e:
        raise RuntimeError(f"Failed to save filter: {e}") from e


def read_file_content(hash_id: str) -> Optional[str]:
    """Return raw JSON string from file if it exists, else None"""
    file_path = FILTERS_DIR / f"{hash_id}.json"
    if not file_path.exists():
        return None
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()


def load_filter_file(hash_id: str) -> Optional[dict]:
    """Load filter JSON from storage folder. Returns None if not found"""
    content = read_file_content(hash_id)
    if content is None:
        return None
    return json.loads(content)


def generate_unique_hash(
    content: dict,
    hash_func: Callable = hashlib.sha256,
    min_length: int = 16,
    max_length: int = 64
) -> Tuple[str, bool]:
    """
    Generate a unique hash ID for the given content, avoiding collisions

    Args:
        content: Dictionary representing the filter data to hash
        hash_func: Hash function to use (default: hashlib.sha256)
        min_length: Minimum length of hash ID
        max_length: Maximum length of hash ID
                    (cannot exceed hash output length)

    Returns:
        (hash_id, created):
            hash_id: the unique hash ID
            created: True if a new file should be created,
                     False if identical content exists
    """
    # Canonical JSON string
    content_json = json.dumps(content, separators=(",", ":"), sort_keys=True)

    # Compute full SHA-256 hash
    full_hash = hash_func(content_json.encode()).hexdigest()
    k = min_length

    while True:
        candidate = full_hash[:k]
        existing_content = read_file_content(candidate)

        if existing_content is None:
            return (candidate, True)  # new hash → create file
        if json.loads(existing_content) == content:
            return (candidate, False)  # same content → reuse

        # Collision with different content → extend hash
        k += 1
        if k > max_length:
            raise RuntimeError("Hash collision could not be resolved")
