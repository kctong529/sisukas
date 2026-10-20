import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from course_dates import normalize_enrolment_date


class TestNormalizeEnrolmentDate(unittest.TestCase):

    def test_date_only(self):
        self.assertEqual(
            normalize_enrolment_date("2026-12-25"),
            "2026-12-25",
        )

    def test_upstream_timestamp(self):
        self.assertEqual(
            normalize_enrolment_date("2026-12-25T09.00.00"),
            "2026-12-25",
        )

    def test_null(self):
        self.assertIsNone(normalize_enrolment_date(None))

    def test_invalid_date(self):
        with self.assertRaises(ValueError):
            normalize_enrolment_date("2026-02-30")

    def test_invalid_time(self):
        with self.assertRaises(ValueError):
            normalize_enrolment_date("2026-12-25T25.00.00")

    def test_unsupported_timestamp(self):
        with self.assertRaises(ValueError):
            normalize_enrolment_date("2026-12-25T09:00:00")

    def test_invalid_type(self):
        with self.assertRaises(ValueError):
            normalize_enrolment_date(123)


if __name__ == "__main__":
    unittest.main()
