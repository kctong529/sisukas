#!/usr/bin/env python3
"""Validate every field and cross-field invariant in a transformed course catalog.

Requires: jsonschema>=4.18
"""

import argparse
import json
from datetime import date
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


SCHEMA_FILE = Path(__file__).with_name("course_catalog.schema.json")


def validate_courses(courses, schema=None):
    """Return a list of human-readable failures without changing input data."""
    if schema is None:
        schema = json.loads(SCHEMA_FILE.read_text(encoding="utf-8"))

    validator = Draft202012Validator(
        schema,
        format_checker=FormatChecker(),
    )

    errors = []

    for err in validator.iter_errors(courses):
        path = "$" + "".join(
            f"[{x}]" if isinstance(x, int) else f".{x}"
            for x in err.absolute_path
        )
        errors.append(f"{path}: {err.message}")

    if not isinstance(courses, list):
        return sorted(errors)

    seen = set()

    for i, course in enumerate(courses):
        if not isinstance(course, dict):
            continue

        cid = course.get("id")

        if isinstance(cid, str) and cid:
            if cid in seen:
                errors.append(f"$[{i}].id: duplicate ID {cid!r}")
            seen.add(cid)

        def parsed(field):
            value = course.get(field)

            if not isinstance(value, str):
                return None

            try:
                if (
                    len(value) == 10
                    and value[4] == "-"
                    and value[7] == "-"
                ):
                    return date.fromisoformat(value)
            except ValueError:
                pass

            return None

        start = parsed("startDate")
        end = parsed("endDate")

        if start is not None and end is not None and start > end:
            errors.append(
                f"$[{i}]: startDate after endDate ({cid})"
            )

        es = parsed("enrolmentStartDate")
        ee = parsed("enrolmentEndDate")

        if es is not None and ee is not None and es > ee:
            errors.append(
                f"$[{i}]: enrolmentStartDate after "
                f"enrolmentEndDate ({cid})"
            )

        credits = course.get("credits")

        if isinstance(credits, dict):
            low = credits.get("min")
            high = credits.get("max")

            if (
                type(low) in (int, float)
                and type(high) in (int, float)
                and low > high
            ):
                errors.append(
                    f"$[{i}].credits: min greater than max ({cid})"
                )

    return sorted(errors)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("catalog", type=Path)
    parser.add_argument("--max-errors", type=int, default=30)

    args = parser.parse_args()

    courses = json.loads(
        args.catalog.read_text(encoding="utf-8")
    )

    errors = validate_courses(courses)

    if errors:
        print(f"FAILED: {len(errors)} validation error(s)")

        for error in errors[:args.max_errors]:
            print(" -", error)

        raise SystemExit(1)

    print(
        f"PASS: {len(courses)} records, "
        "all fields and cross-field invariants validated"
    )


if __name__ == "__main__":
    main()
