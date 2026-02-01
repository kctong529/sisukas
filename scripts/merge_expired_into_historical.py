#!/usr/bin/env python3
import json, sys
from pathlib import Path

def load_list(path: str):
    p = Path(path)
    if not p.exists():
        return []
    with p.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise SystemExit(f"Expected top-level array in {path}")
    return data

def main():
    if len(sys.argv) != 4:
        print("Usage: merge_expired_into_historical.py <historical_in.json> <expired.json> <historical_out.json>")
        sys.exit(1)

    hist_in, expired_in, hist_out = sys.argv[1], sys.argv[2], sys.argv[3]
    historical = load_list(hist_in)
    expired = load_list(expired_in)

    by_id = {c["id"]: c for c in historical}
    added = 0
    for c in expired:
        cid = c["id"]
        if cid not in by_id:
            by_id[cid] = c
            added += 1

    merged = list(by_id.values())

    Path(hist_out).parent.mkdir(parents=True, exist_ok=True)
    with open(hist_out, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)

    print(f"Merged historical: {len(historical)} + {len(expired)} (added {added}) => {len(merged)}")

if __name__ == "__main__":
    main()
