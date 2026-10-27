"""Tests for mapping SISU study-event occurrences into domain models (#89)."""

import json
from pathlib import Path
from unittest.mock import Mock

import pytest

from sisu_wrapper.service import SisuService


FIXTURES = Path(__file__).parent / "fixtures" / "study_events"


def fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def parse_events(record: dict):
    """Exercise the real service mapping without making HTTP requests."""
    client = Mock()
    client.fetch_study_events.return_value = [record]
    service = SisuService(client)
    group_set = {
        "name": {"en": "Lecture"},
        "studySubGroups": [
            {
                "id": "subgroup-1",
                "name": {"en": "L01"},
                "studyEventIds": [record["id"]],
            }
        ],
    }
    groups = service._parse_study_groups(group_set)
    client.fetch_study_events.assert_called_once_with([record["id"]])
    assert len(groups) == 1
    assert groups[0].group_id == "subgroup-1"
    return groups[0].study_events


@pytest.mark.parametrize(
    ("filename", "expected_count"),
    [("weekly_lecture.json", 6), ("single_exam.json", 1)],
)
def test_mapping_preserves_series_identity_and_timestamps(filename, expected_count):
    record = fixture(filename)
    events = parse_events(record)

    assert len(events) == expected_count
    for result, source in zip(events, record["events"], strict=True):
        assert result.series_id == record["id"]
        assert result.start == source["start"]
        assert result.end == source["end"]
        assert result.start_iso is not None
        assert result.end_iso is not None


def test_mapping_inherits_default_locations():
    events = parse_events(fixture("weekly_lecture.json"))

    assert all(event.location_ids == ["aalto-TILA-457"] for event in events)


def test_mapping_uses_irregular_location_instead_of_default():
    record = fixture("weekly_lecture.json")
    record["events"][1]["irregularLocationIds"] = ["room-override"]
    events = parse_events(record)

    assert events[0].location_ids == ["aalto-TILA-457"]
    assert events[1].location_ids == ["room-override"]
    assert events[2].location_ids == ["aalto-TILA-457"]


def test_explicit_empty_override_differs_from_null():
    """A present empty override is distinct from an absent override."""
    record = fixture("weekly_lecture.json")
    record["events"][0]["irregularLocationIds"] = []
    events = parse_events(record)

    assert events[0].location_ids == []
    assert events[1].location_ids == ["aalto-TILA-457"]


def test_mapping_handles_missing_locations():
    record = fixture("single_exam.json")
    record.pop("locationIds")
    events = parse_events(record)

    assert len(events) == 1
    assert events[0].location_ids == []


def test_mapping_preserves_occurrence_status_and_notice():
    """Synthetic exception: semantics still need real-world verification."""
    record = fixture("weekly_lecture.json")
    record["events"][0].update(
        cancelled=True, excluded=True, notice="Schedule changed"
    )
    events = parse_events(record)

    assert events[0].cancelled is True
    assert events[0].excluded is True
    assert events[0].notice == "Schedule changed"
    assert events[1].cancelled is False
    assert events[1].excluded is False
    assert events[1].notice is None


def test_location_lists_are_not_shared_between_occurrences():
    events = parse_events(fixture("weekly_lecture.json"))
    events[0].location_ids.append("another-room")

    assert events[1].location_ids == ["aalto-TILA-457"]


def test_existing_datetime_behavior_is_preserved():
    event = parse_events(fixture("single_exam.json"))[0]

    assert event.start_datetime.tzinfo is not None
    assert event.end_datetime > event.start_datetime
    assert event.start_iso == event.start_datetime.isoformat()
    assert event.end_iso == event.end_datetime.isoformat()
