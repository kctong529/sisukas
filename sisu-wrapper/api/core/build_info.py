"""
api/core/build_info.py
======================

Build and runtime metadata for the /health endpoint.

This module exposes a single, process-wide BuildInfo object that:
- Is stable for the lifetime of the process
- Captures deployment metadata (commit hash, build time)
- Uses the API's own semantic version (API_VERSION) as the canonical version

Versioning rules
----------------
- Python APIs always expose API_VERSION.
- There is no APP_VERSION for APIs.
- Commit hash and build time describe *which deployment* is running,
  not the API contract itself.

Expected environment variables
------------------------------
- SERVICE_NAME      : Logical service identifier
- ENVIRONMENT       : Runtime environment (test / production)
- GIT_COMMIT_SHA    : Git commit deployed
- BUILD_TIME_ISO    : UTC build timestamp (ISO-8601)
"""

import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone

from core.config import API_VERSION, API_TITLE, ENV

_started_at = datetime.now(timezone.utc)
_started_at_ts = time.time()

def _env(k: str, default: str = "") -> str:
    """Read an environment variable with a default."""
    return os.getenv(k, default)

@dataclass(frozen=True)
class BuildInfo:
    service: str
    environment: str
    version: str
    commit: str
    build_time: str
    started_at: datetime
    started_at_ts: float

build_info = BuildInfo(
    service=_env("SERVICE_NAME", API_TITLE),
    environment=_env("ENVIRONMENT", ENV),
    version=f"v{API_VERSION}" if API_VERSION else "",
    commit=_env("GIT_COMMIT_SHA", ""),
    build_time=_env("BUILD_TIME_ISO", ""),
    started_at=_started_at,
    started_at_ts=_started_at_ts,
)
