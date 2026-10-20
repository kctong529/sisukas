#!/usr/bin/env python3
"""Validate transformed course catalog data before publication."""

import argparse
import json
import re
from datetime import date
from pathlib import Path

DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ENROLMENT_FIELDS = ("enrolmentStartDate", "enrolmentEndDate")


def validate_courses(courses):
    errors = []
    seen_ids = set()

    if not isinstance(courses, list):
        return ["Catalog must be a JSON array"]

    if not courses:
        return ["Catalog must not be empty"]

    for index, course in enumerate(courses):
        if not isinstance(course, dict):
            errors.append(f"Record {index}: expected an object")
            continue

        course_id = course.get("id")

        if not isinstance(course_id, str) or not course_id:
            errors.append(f"Record {index}: missing or invalid ID")
        elif course_id in seen_ids:
            errors.append(f"Duplicate course ID: {course_id}")
        else:
            seen_ids.add(course_id)

        for field in ENROLMENT_FIELDS:
            value = course.get(field)

            if value is None:
                continue

            if not isinstance(value, str) or not DATE_PATTERN.fullmatch(value):
                errors.append(
                    f"{course_id}: invalid {field}: {value!r}"
                )
                continue

            try:
                date.fromisoformat(value)
            except ValueError:
                errors.append(
                    f"{course_id}: impossible {field}: {value!r}"
                )

    return errors


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("catalog", type=Path)
    args = parser.parse_args()

    with args.catalog.open(encoding="utf-8") as file:
        courses = json.load(file)

    errors = validate_courses(courses)

    if errors:
        print(f"Catalog validation failed: {len(errors)} error(s)")
        for error in errors[:30]:
            print(f"  - {error}")
        raise SystemExit(1)

    print(f"Catalog validation passed: {len(courses)} records")


if __name__ == "__main__":
    main()
    