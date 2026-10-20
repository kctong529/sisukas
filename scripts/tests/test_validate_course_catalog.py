import sys
import unittest

from copy import deepcopy
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from validate_course_catalog import validate_courses


COURSE = {
    "id": "test-1",
    "code": "CS-1234",
    "startDate": "2026-10-20",
    "endDate": "2026-11-20",
    "type": "teaching-participation-contact",
    "name": {
        "fi": "",
        "sv": "",
        "en": "Example",
    },
    "summary": {
        "prerequisites": {
            "fi": "",
            "sv": "",
            "en": "",
        },
        "level": {
            "fi": "",
            "sv": "",
            "en": "advanced-studies",
        },
    },
    "organizationName": {
        "fi": "",
        "sv": "",
        "en": "School",
    },
    "credits": {
        "min": 5,
        "max": 6,
    },
    "courseUnitId": "unit-1",
    "languageOfInstructionCodes": ["en"],
    "teachers": [],
    "enrolmentStartDate": None,
    "enrolmentEndDate": None,
}


class TestCatalogValidation(unittest.TestCase):

    def check_bad(self, mutate):
        data = deepcopy(COURSE)
        mutate(data)
        self.assertTrue(validate_courses([data]))

    def test_valid_course(self):
        self.assertEqual(
            validate_courses([deepcopy(COURSE)]),
            [],
        )

    def test_unknown_field(self):
        self.check_bad(
            lambda c: c.update(unexpected=5)
        )

    def test_missing_field(self):
        self.check_bad(
            lambda c: c.pop("teachers")
        )

    def test_invalid_nested_language(self):
        self.check_bad(
            lambda c: c["name"].update(en=None)
        )

    def test_missing_nested_language(self):
        self.check_bad(
            lambda c: c["summary"]["level"].pop("sv")
        )

    def test_invalid_credits(self):
        self.check_bad(
            lambda c: c.update(
                credits={"min": 7, "max": 5}
            )
        )

    def test_invalid_dates(self):
        self.check_bad(
            lambda c: c.update(startDate="2026-02-30")
        )

    def test_timestamp_regression(self):
        self.check_bad(
            lambda c: c.update(
                enrolmentStartDate="2026-10-20T09.00.00"
            )
        )

    def test_mismatched_null_dates(self):
        self.check_bad(
            lambda c: c.update(
                enrolmentStartDate="2026-10-20"
            )
        )

    def test_invalid_array_member(self):
        self.check_bad(
            lambda c: c.update(teachers=[None])
        )

    def test_duplicate_id(self):
        self.assertTrue(
            validate_courses([
                deepcopy(COURSE),
                deepcopy(COURSE),
            ])
        )

    def test_empty_catalog(self):
        self.assertTrue(validate_courses([]))


if __name__ == "__main__":
    unittest.main()
