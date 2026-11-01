#!/usr/bin/env python3
"""Verify reconciliation artifacts and produce a CSV of archive candidates.

This is a manual, read-only audit of catalog inputs; it does not approve
archival decisions or publish data. Use the same --as-of as reconciliation.
"""
import argparse
import csv
import json
from collections import Counter
from datetime import date
from pathlib import Path

from reconcile_active_courses import _end_date, _index


def load(path):
    with path.open(encoding="utf-8") as stream:
        return _index(json.load(stream), str(path))


def validate(previous, latest, active, candidates, retained, as_of):
    """Raise ValueError if artifacts do not match reconciliation semantics."""
    missing = previous.keys() - latest.keys()
    expected_archive = {
        cid for cid in missing if _end_date(previous[cid]) < as_of
    }
    expected_retained = missing - expected_archive

    def check(actual, expected, label):
        if actual != expected:
            raise ValueError(
                f"{label}: missing {sorted(expected - actual)}, "
                f"unexpected {sorted(actual - expected)}"
            )

    check(candidates.keys(), expected_archive, "archive candidates")
    check(retained.keys(), expected_retained, "carried-forward IDs")
    check(active.keys(), latest.keys() | expected_retained, "active IDs")

    for label, records, source in (
        ("archive candidate", candidates, previous),
        ("carried-forward", retained, previous),
        ("active latest", {cid: active[cid] for cid in latest}, latest),
    ):
        for cid, record in records.items():
            if record != source[cid]:
                raise ValueError(f"{label} record changed: {cid}")
    for cid, record in retained.items():
        if active[cid] != record:
            raise ValueError(f"active carried-forward record changed: {cid}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("previous", "latest", "active", "candidates", "retained"):
        parser.add_argument(f"--{name}", type=Path, required=True)
    parser.add_argument("--as-of", type=date.fromisoformat, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        sources = [load(getattr(args, name)) for name in
                   ("previous", "latest", "active", "candidates", "retained")]
        previous, latest, active, candidates, retained = sources
        validate(*sources, args.as_of)

        by_year, by_month = Counter(), Counter()
        rows = []
        for cid, record in candidates.items():
            end = _end_date(record)
            by_year[end.year] += 1
            by_month[end.strftime("%Y-%m")] += 1
            name = record.get("name", {})
            rows.append({
                "id": cid,
                "code": record.get("code", ""),
                "name_en": name.get("en", "") if isinstance(name, dict) else "",
                "startDate": record.get("startDate", ""),
                "endDate": record["endDate"],
                "days_since_end": (args.as_of - end).days,
                "type": record.get("type", ""),
            })
        rows.sort(key=lambda row: (row["endDate"], row["id"]), reverse=True)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open("w", newline="", encoding="utf-8") as stream:
            writer = csv.DictWriter(stream, fieldnames=[
                "id", "code", "name_en", "startDate", "endDate",
                "days_since_end", "type",
            ])
            writer.writeheader()
            writer.writerows(rows)
    except (OSError, ValueError, TypeError, KeyError) as exc:
        parser.exit(1, f"ERROR: audit failed: {exc}\n")

    print("PASS: reconciliation classification verified")
    for label, dataset in (("Previous", previous), ("Latest", latest),
                           ("Active", active), ("Archive candidates", candidates),
                           ("Carried forward", retained)):
        print(f"{label}: {len(dataset)}")
    print("\nArchive candidates by end year:")
    for year, count in sorted(by_year.items()):
        print(f"  {year}: {count}")
    print("\nMost recent 12 end months:")
    for month, count in sorted(by_month.items(), reverse=True)[:12]:
        print(f"  {month}: {count}")
    print(f"\nFull audit CSV: {args.output}")


if __name__ == "__main__":
    main()
