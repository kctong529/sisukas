"""Best-effort location resolution; all requests are mocked."""

import json
from pathlib import Path
from unittest.mock import Mock

from sisu_wrapper.models import StudyEvent, StudyGroup
from sisu_wrapper.service import SisuService
from sisu_wrapper.exceptions import SisuConnectionError

FIXTURES = Path(__file__).parent / "fixtures" / "study_events"


def fixture(name):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def groups():
    event_a = StudyEvent(
        start="2026-08-31T10:15:00", end="2026-08-31T12:00:00",
        location_ids=["aalto-TILA-457"],
    )
    event_b = StudyEvent(
        start="2026-09-07T10:15:00", end="2026-09-07T12:00:00",
        location_ids=["aalto-TILA-457", "aalto-TILA-488"],
    )
    return [StudyGroup("g", "L01", "Lecture", [event_a, event_b])]


def test_resolves_two_rooms_with_embedded_building():
    data = {
        "aalto-TILA-457": fixture("lecture_location.json"),
        "aalto-TILA-488": fixture("exam_location.json"),
    }
    client = Mock()
    client.fetch_location.side_effect = data.__getitem__
    original = groups()
    resolved = SisuService(client).resolve_study_group_locations(original)
    first, second = resolved[0].study_events
    assert first.locations[0].name == "TU1 Saab Auditorium - 1017"
    assert first.locations[0].building_name == "Maarintie 8"
    assert first.locations[0].address == "Maarintie 8, 02150 Espoo"
    assert second.locations[1].name == "AS2 - 2006"
    assert client.fetch_location.call_count == 2
    assert original[0].study_events[0].locations == []
    assert resolved[0] is not original[0]
    assert first.location_ids == ["aalto-TILA-457"]


def test_lookup_failure_does_not_drop_events_or_source_ids():
    client = Mock()
    client.fetch_location.side_effect = SisuConnectionError("offline")
    resolved = SisuService(client).resolve_study_group_locations(groups())
    assert len(resolved[0].study_events) == 2
    assert all(not event.locations for event in resolved[0].study_events)
    assert resolved[0].study_events[1].location_ids == [
        "aalto-TILA-457", "aalto-TILA-488"
    ]
    assert client.fetch_location.call_count == 2


def test_empty_locations_do_not_trigger_fetch():
    client = Mock()
    original = [StudyGroup("g", "L01", "Lecture", [
        StudyEvent("2026-08-31T10:15:00", "2026-08-31T12:00:00")
    ])]
    result = SisuService(client).resolve_study_group_locations(original)
    client.fetch_location.assert_not_called()
    assert result[0].study_events[0].locations == []


def test_missing_building_and_translation_fallback():
    service = SisuService(Mock())
    location = service._parse_location({
        "id": "room-x", "name": {"sv": "Sal X"},
    })
    assert location.name == "Sal X"
    assert location.building_name is None
    assert location.address is None


def test_malformed_or_mismatched_location_is_ignored():
    client = Mock()
    client.fetch_location.return_value = {"id": "wrong"}
    result = SisuService(client).resolve_study_group_locations(groups())
    assert result[0].study_events[0].locations == []


def test_client_location_path():
    from sisu_wrapper.client import SisuClient

    client = SisuClient()
    client.get_json = Mock(return_value={"id": "aalto-TILA-457"})
    assert client.fetch_location("aalto-TILA-457") == {"id": "aalto-TILA-457"}
    client.get_json.assert_called_once_with(
        "/locations/v1/aalto-TILA-457", timeout=None
    )
