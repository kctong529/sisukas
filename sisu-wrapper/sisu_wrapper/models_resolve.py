# sisu_wrapper/api/models_resolve.py

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, TypedDict


ResolveStatus = Literal["active", "historical", "archived", "ambiguous", "not_found"]
ResolveConfidence = Literal["high", "medium", "low"]


class ResolveSource(TypedDict, total=False):
    resolver: str
    endpoints: List[str]
    retrieved_at: str


class ResolveMatch(TypedDict, total=False):
    course_unit_id: str
    code: str
    name: str
    lang: str
    group_id: str
    organisations: List[str]
    curriculum_period_ids: List[str]
    assessment_item_ids: List[str]
    credits: Dict[str, Any]
    activity_periods: List[Dict[str, str]]
    attainment_language_urns: List[str]
    source: ResolveSource
    raw: Dict[str, Any]


class ResolveResponse(TypedDict, total=False):
    course_code: str
    status: ResolveStatus
    confidence: ResolveConfidence
    matches: List[ResolveMatch]
    total: int
