import sys
from copy import deepcopy
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from audit_archive_candidates import validate
from reconcile_active_courses import _index, reconcile_active_courses


class TestArchiveAudit(unittest.TestCase):
    def setUp(self):
        self.as_of = date(2026, 10, 20)
        self.previous = [
            {"id": "old", "endDate": "2026-10-19"},
            {"id": "today", "endDate": "2026-10-20"},
            {"id": "updated", "endDate": "2026-12-01", "code": "A"},
        ]
        self.latest = [{"id": "updated", "endDate": "2027-01-01", "code": "B"}]
        active, candidates, retained = reconcile_active_courses(
            self.previous, self.latest, self.as_of
        )
        self.data = [
            _index(deepcopy(records), name) for records, name in zip(
                (self.previous, self.latest, active, candidates, retained),
                ("previous", "latest", "active", "candidates", "retained"),
            )
        ]

    def test_valid_reconciliation(self):
        validate(*self.data, self.as_of)

    def test_missing_archive_candidate(self):
        self.data[3].clear()
        with self.assertRaisesRegex(ValueError, "archive candidates"):
            validate(*self.data, self.as_of)

    def test_modified_retained_record(self):
        self.data[4]["today"]["code"] = "changed"
        with self.assertRaisesRegex(ValueError, "carried-forward record changed"):
            validate(*self.data, self.as_of)

    def test_modified_latest_active_record(self):
        self.data[2]["updated"]["code"] = "changed"
        with self.assertRaisesRegex(ValueError, "active latest record changed"):
            validate(*self.data, self.as_of)

    def test_invalid_missing_course_end_date(self):
        self.data[0]["old"]["endDate"] = "bad"
        with self.assertRaisesRegex(ValueError, "invalid endDate"):
            validate(*self.data, self.as_of)


if __name__ == "__main__":
    unittest.main()
