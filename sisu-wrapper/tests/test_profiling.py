"""Unit tests for opt-in study-group diagnostics."""
from sisu_wrapper import profiling


def test_logging_disabled_by_default(monkeypatch, caplog):
    monkeypatch.delenv("SISUKAS_PROFILE_STUDY_GROUPS", raising=False)
    with caplog.at_level("INFO", logger="uvicorn.error"):
        profiling.log("batch_start", count=2)
    assert "perf161.batch_start" not in caplog.text


def test_batch_context_and_safe_resource_names(monkeypatch, caplog):
    monkeypatch.setenv("SISUKAS_PROFILE_STUDY_GROUPS", "1")
    token = profiling.start_batch()
    try:
        batch = profiling.current_batch()
        assert batch and len(batch) == 12
        with caplog.at_level("INFO", logger="uvicorn.error"):
            profiling.log("upstream", resource=profiling.upstream_kind("/course-units/private-id"), status=200)
        assert f"perf161.upstream batch={batch}" in caplog.text
        assert "resource=course_unit" in caplog.text
        assert "private-id" not in caplog.text
    finally:
        profiling.end_batch(token)
    assert profiling.current_batch() is None


def test_resource_categories_do_not_leak_ids():
    assert profiling.upstream_kind("/study-events") == "study_events"
    assert profiling.upstream_kind("/locations/v1/sensitive") == "location"
    assert profiling.upstream_kind("/course-unit-realisations/published") == "published_realisations"


def test_elapsed_ms_is_nonnegative():
    from time import perf_counter
    assert profiling.elapsed_ms(perf_counter()) >= 0
