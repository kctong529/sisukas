from datetime import date


def reconcile_active_courses(previous, latest, as_of: date):
    previous_by_id = {course["id"]: course for course in previous}
    latest_by_id = {course["id"]: course for course in latest}

    retained = []
    eligible_for_archive = []

    for course_id, old_course in previous_by_id.items():
        if course_id in latest_by_id:
            continue

        end_date = date.fromisoformat(old_course["endDate"])

        if end_date >= as_of:
            retained.append(old_course)
        else:
            eligible_for_archive.append(old_course)

    active = list(latest)

    # Preserve disappearing implementations until their end dates pass.
    active.extend(retained)

    return active, eligible_for_archive, retained


def main():
    import argparse
    import json
    from datetime import date
    from pathlib import Path

    parser = argparse.ArgumentParser(
        description="Reconcile active courses against the latest API catalog."
    )

    parser.add_argument("--previous", type=Path, required=True)
    parser.add_argument("--latest", type=Path, required=True)
    parser.add_argument("--as-of", type=date.fromisoformat, default=date.today())

    parser.add_argument("--active-out", type=Path, required=True)
    parser.add_argument("--archive-out", type=Path, required=True)
    parser.add_argument("--retained-out", type=Path, required=True)

    args = parser.parse_args()

    def load(path):
        return json.loads(path.read_text(encoding="utf-8"))

    previous = load(args.previous)
    latest = load(args.latest)

    active, archive_candidates, retained = reconcile_active_courses(
        previous,
        latest,
        args.as_of,
    )

    outputs = {
        args.active_out: active,
        args.archive_out: archive_candidates,
        args.retained_out: retained,
    }

    for path, records in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(records, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    print(f"Previous active: {len(previous)}")
    print(f"Latest upstream: {len(latest)}")
    print(f"Reconciled active: {len(active)}")
    print(f"Archive candidates: {len(archive_candidates)}")
    print(f"Carried forward: {len(retained)}")


if __name__ == "__main__":
    main()
