import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from course_dates import normalize_course_date


class TestNormalizeCourseDate(unittest.TestCase):

    def test_date_only(self):
        self.assertEqual(
            normalize_course_date("2026-12-25"),
            "2026-12-25",
        )

    def test_upstream_timestamp(self):
        self.assertEqual(
            normalize_course_date("2026-12-25T09.00.00"),
            "2026-12-25",
        )

    def test_midnight_timestamp(self):
        self.assertEqual(
            normalize_course_date("2026-10-20T00.00.00"),
            "2026-10-20",
        )

    def test_leap_day(self):
        self.assertEqual(
            normalize_course_date("2028-02-29"),
            "2028-02-29",
        )

    def test_nullable_missing_date(self):
        self.assertIsNone(
            normalize_course_date(None, nullable=True)
        )

    def test_required_missing_date(self):
        with self.assertRaises(ValueError):
            normalize_course_date(None)

    def test_invalid_calendar_date(self):
        with self.assertRaises(ValueError):
            normalize_course_date("2026-02-30")

    def test_invalid_leap_day(self):
        with self.assertRaises(ValueError):
            normalize_course_date("2027-02-29")

    def test_invalid_timestamp_date(self):
        with self.assertRaises(ValueError):
            normalize_course_date("2026-02-30T09.00.00")

    def test_invalid_hour(self):
        with self.assertRaises(ValueError):
            normalize_course_date("2026-12-25T25.00.00")

    def test_invalid_minute(self):
        with self.assertRaises(ValueError):
            normalize_course_date("2026-12-25T09.60.00")

    def test_invalid_second(self):
        with self.assertRaises(ValueError):
            normalize_course_date("2026-12-25T09.00.60")

    def test_unsupported_iso_timestamp(self):
        with self.assertRaises(ValueError):
            normalize_course_date("2026-12-25T09:00:00")

    def test_timezone_timestamp(self):
        with self.assertRaises(ValueError):
            normalize_course_date("2026-12-25T09:00:00+02:00")

    def test_empty_string(self):
        with self.assertRaises(ValueError):
            normalize_course_date("")

    def test_invalid_type(self):
        for value in (123, True, [], {}):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    normalize_course_date(value)

    def test_preserves_calendar_date(self):
        self.assertEqual(
            normalize_course_date("2026-12-31T23.59.59"),
            "2026-12-31",
        )


if __name__ == "__main__":
    unittest.main()
