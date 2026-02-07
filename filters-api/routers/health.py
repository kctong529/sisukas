"""
routers/health.py
=====================

Health and build metadata endpoint for the Sisukas Filters API.

This module defines a standardized /health endpoint used for:
- Service uptime and readiness checks
- Deployment verification (version, commit, build time)
- Lightweight operational diagnostics

The response contract is intentionally stable and machine-readable,
making it suitable for monitoring systems and CI/CD verification.
"""

import time
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Response
from pydantic import BaseModel

from core.build_info import build_info
from core.config import CORS_ORIGINS_EFFECTIVE, ENV, GCS_BUCKET_NAME

router = APIRouter()


class HealthCheck(BaseModel):
    """Represents a single dependency check (optional)."""
    name: str
    status: Literal["ok", "error"]
    latencyMs: Optional[int] = None
    details: Optional[Dict[str, Any]] = None


class HealthResponse(BaseModel):
    """Top-level health response contract."""
    status: Literal["ok", "degraded", "error"]
    service: str
    environment: str
    version: str
    commit: str
    buildTime: str
    startedAt: str
    uptimeSec: int
    checks: List[HealthCheck]
    publicConfig: Dict[str, Any]


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service health and build information",
)
async def health(response: Response):
    """
    Service health and build information.

    This endpoint reports the current operational status of the service along
    with build-time and runtime metadata. It is intended for load balancers,
    CI/CD verification, monitoring, and manual diagnostics.
    """
    checks: List[HealthCheck] = []
    overall: Literal["ok", "degraded", "error"] = "ok"

    if not GCS_BUCKET_NAME:
        checks.append(
            HealthCheck(
                name="storage_config",
                status="error",
                details={"error": "Missing GCS_BUCKET_NAME"},
            )
        )
        overall = "degraded"

    body = HealthResponse(
        status=overall,
        service=build_info.service,
        environment=build_info.environment,
        version=build_info.version,
        commit=build_info.commit,
        buildTime=build_info.build_time,
        startedAt=build_info.started_at.isoformat(),
        uptimeSec=int(time.time() - build_info.started_at_ts),
        checks=checks,
        publicConfig={
            "corsOrigins": CORS_ORIGINS_EFFECTIVE,
            "gcsBucketName": GCS_BUCKET_NAME or "",
            "env": ENV,  # optional; can remove if you feel redundant
        },
    )

    response.status_code = 200 if overall == "ok" else 503
    return body
