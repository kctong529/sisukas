"""HTTP-level tests for optional SISU room enrichment (no network calls)."""

from unittest.mock import Mock
from pathlib import Path
import sys

# Match uvicorn --app-dir api, used by the existing API deployment.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routers import courses
from sisu_wrapper.models import StudyEvent, StudyGroup, StudyLocation


UNIT = "unit-1"
OFFERING = "offering-1"


def _groups(resolved=False):
    event = StudyEvent(
        start="2026-08-31T10:15:00",
        end="2026-08-31T12:00:00",
        series_id="event-1",
        location_ids=["room-1"],
        locations=[StudyLocation(
            id="room-1", name="Room A", building_name="Campus",
            address="Street 1",
        )] if resolved else [],
    )
    return [StudyGroup(
        group_id="group-1", name="L01", type="Lecture",
        study_events=[event],
    )]


def _client(monkeypatch):
    service = Mock()
    service.fetch_study_groups.return_value = _groups()
    service.fetch_study_groups_with_locations.return_value = _groups(True)
    service.fetch_study_groups_batch.return_value = {(UNIT, OFFERING): _groups()}
    service.resolve_study_group_locations.return_value = _groups(True)
    monkeypatch.setattr(courses, "_service", service)
    app = FastAPI()
    app.include_router(courses.router)
    return TestClient(app), service


def test_single_default_is_unresolved(monkeypatch):
    client, service = _client(monkeypatch)
    response = client.get("/api/courses/study-groups", params={
        "course_unit_id": UNIT, "course_offering_id": OFFERING,
    })
    assert response.status_code == 200
    event = response.json()["study_groups"][0]["study_events"][0]
    assert event["series_id"] == "event-1"
    assert event["location_ids"] == ["room-1"]
    assert event["locations"] == []
    service.fetch_study_groups_with_locations.assert_not_called()


def test_single_opt_in_serializes_room(monkeypatch):
    client, service = _client(monkeypatch)
    response = client.get("/api/courses/study-groups", params={
        "course_unit_id": UNIT, "course_offering_id": OFFERING,
        "resolve_locations": "true",
    })
    assert response.status_code == 200
    event = response.json()["study_groups"][0]["study_events"][0]
    assert event["locations"][0]["name"] == "Room A"
    assert event["locations"][0]["address"] == "Street 1"
    service.fetch_study_groups_with_locations.assert_called_once_with(UNIT, OFFERING)


def test_single_location_failure_remains_usable(monkeypatch):
    client, service = _client(monkeypatch)
    service.fetch_study_groups_with_locations.return_value = _groups(False)
    response = client.get("/api/courses/study-groups", params={
        "course_unit_id": UNIT, "course_offering_id": OFFERING,
        "resolve_locations": "true",
    })
    assert response.status_code == 200
    event = response.json()["study_groups"][0]["study_events"][0]
    assert event["location_ids"] == ["room-1"]
    assert event["locations"] == []


def test_batch_default_is_unresolved(monkeypatch):
    client, service = _client(monkeypatch)
    response = client.post("/api/courses/batch/study-groups", json={
        "requests": [{"course_unit_id": UNIT, "course_offering_id": OFFERING}],
    })
    assert response.status_code == 200
    event = response.json()["results"][f"{UNIT}:{OFFERING}"][0]["study_events"][0]
    assert event["locations"] == []
    service.resolve_study_group_locations.assert_not_called()


def test_batch_opt_in_serializes_room(monkeypatch):
    client, service = _client(monkeypatch)
    response = client.post(
        "/api/courses/batch/study-groups?resolve_locations=true",
        json={"requests": [
            {"course_unit_id": UNIT, "course_offering_id": OFFERING}
        ]},
    )
    assert response.status_code == 200
    event = response.json()["results"][f"{UNIT}:{OFFERING}"][0]["study_events"][0]
    assert event["locations"][0]["id"] == "room-1"
    service.resolve_study_group_locations.assert_called_once()


def test_invalid_boolean_and_missing_identifiers(monkeypatch):
    client, service = _client(monkeypatch)
    invalid = client.get("/api/courses/study-groups", params={
        "course_unit_id": UNIT, "course_offering_id": OFFERING,
        "resolve_locations": "perhaps",
    })
    missing = client.get("/api/courses/study-groups", params={
        "course_unit_id": UNIT,
    })
    assert invalid.status_code == 422
    assert missing.status_code == 422
    service.fetch_study_groups.assert_not_called()


def test_openapi_describes_opt_in_for_both_routes(monkeypatch):
    client, _ = _client(monkeypatch)
    paths = client.get("/openapi.json").json()["paths"]
    for path, method in [
        ("/api/courses/study-groups", "get"),
        ("/api/courses/batch/study-groups", "post"),
    ]:
        parameters = paths[path][method]["parameters"]
        flag = next(p for p in parameters if p["name"] == "resolve_locations")
        assert flag["required"] is False
        assert flag["schema"]["default"] is False
