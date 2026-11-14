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


def test_batch_profiling_preserves_response_and_emits_phases(monkeypatch, caplog):
    """Opt-in profiling must not change the batch response or service calls."""
    from sisu_wrapper import profiling

    client, service = _client(monkeypatch)
    payload = {"requests": [
        {"course_unit_id": UNIT, "course_offering_id": OFFERING}
    ]}

    monkeypatch.delenv("SISUKAS_PROFILE_STUDY_GROUPS", raising=False)
    without_profile = client.post(
        "/api/courses/batch/study-groups?resolve_locations=true",
        json=payload,
    )

    monkeypatch.setenv("SISUKAS_PROFILE_STUDY_GROUPS", "1")
    with caplog.at_level("INFO", logger="uvicorn.error"):
        with_profile = client.post(
            "/api/courses/batch/study-groups?resolve_locations=true",
            json=payload,
        )

    assert without_profile.status_code == with_profile.status_code == 200
    assert without_profile.json() == with_profile.json()
    assert service.fetch_study_groups_batch.call_count == 2
    assert service.resolve_study_group_locations.call_count == 2
    assert "perf161.batch_start" in caplog.text
    assert "perf161.batch_phases" in caplog.text
    assert "retrieval_ms=" in caplog.text
    assert "locations_ms=" in caplog.text
    assert "perf161.batch_end" in caplog.text
    assert "outcome=ok" in caplog.text
    assert UNIT not in caplog.text
    assert OFFERING not in caplog.text
    assert profiling.current_batch() is None


def test_batch_profiling_emits_failure_and_clears_context(monkeypatch, caplog):
    """Exceptions must produce a failed completion log without leaking context."""
    from sisu_wrapper import profiling

    client, service = _client(monkeypatch)
    service.fetch_study_groups_batch.side_effect = RuntimeError("test backend failure")
    monkeypatch.setenv("SISUKAS_PROFILE_STUDY_GROUPS", "1")
    with caplog.at_level("INFO", logger="uvicorn.error"):
        response = client.post("/api/courses/batch/study-groups", json={
            "requests": [{"course_unit_id": UNIT, "course_offering_id": OFFERING}]
        })

    assert response.status_code == 500
    assert response.json()["detail"] == "Internal server error"
    assert "perf161.batch_start" in caplog.text
    assert "perf161.batch_end" in caplog.text
    assert "outcome=failed" in caplog.text
    assert profiling.current_batch() is None
