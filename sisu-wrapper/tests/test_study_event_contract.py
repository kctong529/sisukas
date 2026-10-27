"""Observed Aalto Kori API contracts for calendar metadata (#89)."""

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from sisu_wrapper import SisuClient


FIXTURES = Path(__file__).parent / "fixtures" / "study_events"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def test_realisation_links_study_groups_to_event_series():
    realisation = load_fixture("realisation.json")
    groups = realisation["studyGroupSets"]

    lecture = groups[0]["studySubGroups"][0]
    exams = groups[1]["studySubGroups"]
    assert lecture["id"] == "aalto-ssg-4523-211095-1-01"
    assert "aalto-SE-ASIO-9000815-7339722" in lecture["studyEventIds"]
    assert {item["name"]["en"] for item in exams} == {"VK1", "VK2"}
    assert "aalto-SE-ASIO-9000816-7339890" in exams[0]["studyEventIds"]


@pytest.mark.parametrize(
    ("filename", "recurrence", "count"),
    [("weekly_lecture.json", "WEEKLY", 6),
     ("single_exam.json", "NEVER", 1)],
)
def test_event_series_contains_expanded_occurrences(filename, recurrence, count):
    event = load_fixture(filename)
    assert event["recursEvery"] == recurrence
    assert len(event["events"]) == count
    assert event["locationIds"]
    assert all(event[key] == [] for key in
               ("exceptions", "cancellations", "overrides"))

    for occurrence in event["events"]:
        assert occurrence["start"] < occurrence["end"]
        assert isinstance(occurrence["cancelled"], bool)
        assert isinstance(occurrence["excluded"], bool)
        assert "irregularLocationIds" in occurrence
        assert "id" not in occurrence  # observed; not a universal API guarantee


def test_weekly_occurrences_are_ordered():
    starts = [item["start"] for item in
              load_fixture("weekly_lecture.json")["events"]]
    assert starts == sorted(starts)
    assert len(starts) == len(set(starts))


@pytest.mark.parametrize(
    ("filename", "room", "capacity"),
    [("lecture_location.json", "TU1 Saab Auditorium - 1017", 150),
     ("exam_location.json", "AS2 - 2006", 300)],
)
def test_location_embeds_building_and_address(filename, room, capacity):
    location = load_fixture(filename)
    assert location["name"]["fi"] == room
    assert location["capacity"] == capacity
    assert location["buildingId"] == location["building"]["id"]
    assert location["building"]["address"]["city"] == "Espoo"
    assert location["building"]["address"]["streetAddress"] == (
        "Maarintie 8, 02150 Espoo"
    )
    # Observed localization gap: room names need a language fallback.
    assert "en" not in location["name"]


def test_existing_client_retrieves_study_event():
    """No network: ensure the wrapper still requests the observed endpoint."""
    event = load_fixture("weekly_lecture.json")
    with patch.object(SisuClient, "get_json", return_value=[event]) as get:
        result = SisuClient().fetch_study_events([event["id"]])

    get.assert_called_once_with(
        "/study-events", params={"id": event["id"]}, timeout=None
    )
    assert result[0]["id"] == event["id"]
    assert result[0]["locationIds"] == ["aalto-TILA-457"]
