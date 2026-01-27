import json
import sys
import os
from datetime import date
from typing import Any, Dict, List, Optional


def transform_course(c: Dict[str, Any]) -> Dict[str, Any]:
    summary = c.get("summary", {})
    if not isinstance(summary, dict):
        summary = {}

    return {
        "id": c.get("id"),
        "code": c.get("code"),
        "startDate": c.get("startDate"),
        "endDate": c.get("endDate"),
        "type": c.get("type"),
        "name": c.get("name", {}),

        "summary": {
            "prerequisites": summary.get("prerequisites", {}),
            "level": summary.get("level", {}),
        },

        "organizationName": c.get("organizationName", {}),
        "credits": c.get("credits", {}),
        "courseUnitId": c.get("courseUnitId"),
        "languageOfInstructionCodes": c.get("languageOfInstructionCodes"),
        "teachers": c.get("teachers", []),
        "enrolmentStartDate": c.get("enrolmentStartDate"),
        "enrolmentEndDate": c.get("enrolmentEndDate"),
    }

def parse_iso_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return date.fromisoformat(s)
    except ValueError:
        return None

def in_range_by_start_date(c: Dict[str, Any], start: date, end: date) -> bool:
    d = parse_iso_date(c.get("startDate"))
    if d is None:
        return False
    return start <= d <= end

def main() -> None:
    if len(sys.argv) < 3:
        print(
            "Usage: python transform_historical_flat.py <input.json> <output.json> "
            "[--from YYYY-MM-DD --to YYYY-MM-DD]"
        )
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    from_date = None
    to_date = None
    if "--from" in sys.argv:
        from_date = sys.argv[sys.argv.index("--from") + 1]
    if "--to" in sys.argv:
        to_date = sys.argv[sys.argv.index("--to") + 1]

    range_start = date.fromisoformat(from_date) if from_date else None
    range_end = date.fromisoformat(to_date) if to_date else None
    if (range_start is None) != (range_end is None):
        print("Error: provide both --from and --to, or neither.")
        sys.exit(1)

    with open(input_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    if not isinstance(raw, dict):
        print("Error: expected top-level object mapping courseUnitId -> list of records.")
        sys.exit(1)

    flat: List[Dict[str, Any]] = []
    total_in = 0

    for _, recs in raw.items():
        if not isinstance(recs, list):
            continue
        total_in += len(recs)

        for c in recs:
            if not isinstance(c, dict):
                continue

            if range_start and range_end:
                if not in_range_by_start_date(c, range_start, range_end):
                    continue

            flat.append(transform_course(c))

    flat.sort(key=lambda x: (
        str(x.get("code") or ""),
        str(x.get("startDate") or ""),
        str(x.get("id") or "")
    ))

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(flat, f, ensure_ascii=False, indent=2)

    original_size = os.path.getsize(input_path)
    new_size = os.path.getsize(output_path)

    print("Transformation completed.")
    print(f" Records processed (in):  {total_in}")
    print(f" Records kept (out):      {len(flat)}")
    print(f" Original size: {original_size/1024:.1f} KB")
    print(f" Reduced size:  {new_size/1024:.1f} KB")
    if original_size > 0:
        print(f" Reduction:     {100*(1-new_size/original_size):.1f}%")


if __name__ == "__main__":
    main()
