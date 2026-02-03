#!/usr/bin/env python3
import argparse
import json
import os
import sys
from pathlib import Path

def load_list(path: str):
    p = Path(path)
    if not p.exists():
        return []
    with p.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise SystemExit(f"ERROR: expected list in {path}")
    return data

def main():
    parser = argparse.ArgumentParser(description="Count reactivated instances: historical ∩ active.")
    parser.add_argument("--historical", default="historical.json")
    parser.add_argument("--active", default="latest.json")
    args = parser.parse_args()

    historical = load_list(args.historical)
    active = load_list(args.active)

    hist_ids = {c.get("id") for c in historical if isinstance(c, dict) and c.get("id")}
    active_ids = {c.get("id") for c in active if isinstance(c, dict) and c.get("id")}

    count = len(hist_ids & active_ids)
    print(f"reactivated_count {count}")

    if os.getenv("GITHUB_ACTIONS"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write(f"reactivated_count={count}\n")

if __name__ == "__main__":
    main()
