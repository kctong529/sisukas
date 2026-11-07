"""Opt-in, payload-free timing diagnostics for study-group API requests.

Set SISUKAS_PROFILE_STUDY_GROUPS=1 *before starting the wrapper*.
No request IDs, SISU identifiers, URLs, or authentication data are logged.
"""

import logging
import os
from contextvars import ContextVar
from time import perf_counter
from uuid import uuid4

_LOG = logging.getLogger("uvicorn.error")
_BATCH: ContextVar[str | None] = ContextVar("study_group_profile_batch", default=None)


def enabled() -> bool:
    return os.getenv("SISUKAS_PROFILE_STUDY_GROUPS") == "1"


def start_batch():
    """Set a correlation ID and return a token for guaranteed restoration."""
    return _BATCH.set(uuid4().hex[:12])


def end_batch(token) -> None:
    _BATCH.reset(token)


def current_batch() -> str | None:
    return _BATCH.get()


def log(event: str, **fields) -> None:
    if not enabled():
        return
    batch = current_batch() or "none"
    details = " ".join(f"{name}={value}" for name, value in fields.items())
    _LOG.info("perf161.%s batch=%s %s", event, batch, details)


def elapsed_ms(started: float) -> float:
    return round((perf_counter() - started) * 1000, 1)


def upstream_kind(endpoint: str) -> str:
    """Classify fixed API resource paths without logging resource IDs."""
    if endpoint.startswith("/course-units/"):
        return "course_unit"
    if endpoint.startswith("/course-unit-realisations/published"):
        return "published_realisations"
    if endpoint.startswith("/course-unit-realisations"):
        return "realisations"
    if endpoint.startswith("/study-events"):
        return "study_events"
    if endpoint.startswith("/locations/"):
        return "location"
    return "other"
