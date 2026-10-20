#!/usr/bin/env python3
"""Reconcile a previous active catalog with a newly transformed catalog."""
import argparse
import json
import os
import re
import tempfile
from datetime import date, datetime, timezone
from pathlib import Path

ISO_DATE = re.compile(r"\d{4}-\d{2}-\d{2}\Z")


def _index(records, label):
    if not isinstance(records, list):
        raise ValueError(f"{label}: expected a JSON array")
    indexed = {}
    for number, record in enumerate(records):
        if not isinstance(record, dict):
            raise ValueError(f"{label}[{number}]: expected an object")
        identifier = record.get("id")
        if not isinstance(identifier, str) or not identifier.strip():
            raise ValueError(f"{label}[{number}]: invalid id")
        if identifier in indexed:
            raise ValueError(f"{label}: duplicate id {identifier!r}")
        indexed[identifier] = record
    return indexed


def _end_date(record):
    value = record.get("endDate")
    if not isinstance(value, str) or not ISO_DATE.fullmatch(value):
        raise ValueError(f"{record['id']}: invalid endDate {value!r}")
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"{record['id']}: invalid endDate {value!r}") from exc


def reconcile_active_courses(previous, latest, as_of: date):
    if not isinstance(as_of, date) or isinstance(as_of, datetime):
        raise ValueError("as_of must be a date")
    previous_by_id = _index(previous, "previous")
    latest_by_id = _index(latest, "latest")
    if not latest_by_id:
        raise ValueError("latest catalog is empty; refusing to reconcile")

    retained = []
    archive_candidates = []
    for identifier, old_course in previous_by_id.items():
        if identifier in latest_by_id:
            continue
        if _end_date(old_course) >= as_of:
            retained.append(old_course)
        else:
            archive_candidates.append(old_course)
    return list(latest) + retained, archive_candidates, retained


def _write_staged(outputs):
    """Stage all JSON files before replacement; multi-file replacement is not atomic."""
    staged = []
    try:
        for destination, records in outputs.items():
            destination.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(
                mode="w", encoding="utf-8", dir=destination.parent,
                prefix=f".{destination.name}.", suffix=".tmp", delete=False
            ) as stream:
                staged.append((Path(stream.name), destination))
                json.dump(records, stream, ensure_ascii=False, indent=2)
                stream.write("\n")
        for temporary, destination in staged:
            os.replace(temporary, destination)
    finally:
        for temporary, _ in staged:
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--previous", type=Path, required=True)
    parser.add_argument("--latest", type=Path, required=True)
    parser.add_argument("--as-of", type=date.fromisoformat,
                        default=datetime.now(timezone.utc).date())
    parser.add_argument("--active-out", type=Path, required=True)
    parser.add_argument("--archive-out", type=Path, required=True)
    parser.add_argument("--retained-out", type=Path, required=True)
    parser.add_argument("--max-archive-fraction", type=float, default=None,
                        help="Fail when archive candidates exceed this fraction of previous active")
    args = parser.parse_args()

    inputs_and_outputs = [args.previous, args.latest, args.active_out,
                          args.archive_out, args.retained_out]
    if len({p.resolve() for p in inputs_and_outputs}) != len(inputs_and_outputs):
        parser.error("input/output paths must be distinct")
    if args.max_archive_fraction is not None and not 0 <= args.max_archive_fraction <= 1:
        parser.error("--max-archive-fraction must be in [0, 1]")

    try:
        with args.previous.open(encoding="utf-8") as handle:
            previous = json.load(handle)
        with args.latest.open(encoding="utf-8") as handle:
            latest = json.load(handle)
        active, archive, retained = reconcile_active_courses(previous, latest, args.as_of)
        fraction = len(archive) / len(previous) if previous else 0
        if args.max_archive_fraction is not None and fraction > args.max_archive_fraction:
            raise ValueError(
                f"{len(archive)}/{len(previous)} ({fraction:.1%}) archive candidates; "
                f"limit is {args.max_archive_fraction:.1%}. Review before publishing."
            )
        _write_staged({
            args.active_out: active,
            args.archive_out: archive,
            args.retained_out: retained,
        })
    except (OSError, ValueError, TypeError) as exc:
        parser.exit(1, f"ERROR: reconciliation aborted: {exc}\n")

    print(f"Previous active: {len(previous)}")
    print(f"Latest upstream: {len(latest)}")
    print(f"Reconciled active: {len(active)}")
    print(f"Archive candidates: {len(archive)}")
    print(f"Carried forward: {len(retained)}")
    for course in retained[:25]:
        print(f"  carried forward: {course['id']} (ends {course['endDate']})")
    if len(retained) > 25:
        print(f"  ... and {len(retained)-25} more in retained artifact")


if __name__ == "__main__":
    main()
