"""Synthetic exception/serialization regression tests for #89.

No real SISU cancellation or relocation is claimed by these examples.
"""

import json
import sys
from pathlib import Path
from unittest.mock import Mock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from sisu_wrapper.service import SisuService

# The API imports its existing models/utils modules as top-level imports.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))
from api.routers import courses  # noqa: E402

FIXTURE = Path(__file__).parent / "fixtures/study_events/weekly_lecture.json"


def _record():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def _groups(record):
    client = Mock()
    client.fetch_study_events.return_value = [record]
    service = SisuService(client)
    return service._parse_study_groups({
        "name": {"en": "Lecture"},
        "studySubGroups": [{
            "id": "sub-1",
            "name": {"en": "L01"},
            "studyEventIds": [record["id"]],
        }],
    })


def test_mixed_status_flags_are_preserved_without_dropping_events():
    record = _record()
    record["events"][1].update(cancelled=True, notice="Cancelled")
    record["events"][2].update(excluded=True, notice="Excluded")

    events = _groups(record)[0].study_events
    assert len(events) == 6
    assert (events[0].cancelled, events[0].excluded) == (False, False)
    assert (events[1].cancelled, events[1].notice) == (True, "Cancelled")
    assert (events[2].excluded, events[2].notice) == (True, "Excluded")
    assert all(e.series_id == record["id"] for e in events)


def test_irregular_locations_and_empty_override_are_independent():
    record = _record()
    record["events"][1]["irregularLocationIds"] = ["other-room"]
    record["events"][2]["irregularLocationIds"] = []

    events = _groups(record)[0].study_events
    assert [e.location_ids for e in events[:4]] == [
        ["aalto-TILA-457"], ["other-room"], [], ["aalto-TILA-457"]
    ]
    events[1].location_ids.append("mutable-check")
    assert events[0].location_ids == ["aalto-TILA-457"]


def test_http_serialization_preserves_exception_status_and_locations(monkeypatch):
    record = _record()
    record["events"][1].update(
        cancelled=True, notice="Moved", irregularLocationIds=["other-room"]
    )
    record["events"][2].update(excluded=True, irregularLocationIds=[])
    groups = _groups(record)
    service = Mock()
    service.fetch_study_groups.return_value = groups
    monkeypatch.setattr(courses, "_service", service)

    app = FastAPI()
    app.include_router(courses.router)
    response = TestClient(app).get("/api/courses/study-groups", params={
        "course_unit_id": "unit", "course_offering_id": "offering",
    })
    assert response.status_code == 200
    events = response.json()["study_groups"][0]["study_events"]
    assert len(events) == 6
    assert events[1]["cancelled"] is True
    assert events[1]["notice"] == "Moved"
    assert events[1]["location_ids"] == ["other-room"]
    assert events[1]["locations"] == []
    assert events[2]["excluded"] is True
    assert events[2]["location_ids"] == []
    assert events[0]["series_id"] == record["id"]
