"""
api/routers/health.py
=====================

Health and build metadata endpoint for the Sisu Wrapper API.

This module defines a standardized `/health` endpoint used for:
- Service uptime and readiness checks
- Deployment verification (version, commit, build time)
- Lightweight operational diagnostics

The response contract is intentionally stable and machine-readable.
"""

import time
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Response
from pydantic import BaseModel

from core.config import CORS_ORIGINS_EFFECTIVE
from core.build_info import build_info

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
    with build-time and runtime metadata.
    """
    checks: List[HealthCheck] = []
    overall: Literal["ok", "degraded", "error"] = "ok"

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
        },
    )

    response.status_code = 200
    return body
