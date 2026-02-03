#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path

def load_list(path: str):
    p = Path(path)
    if not p.exists():
        raise SystemExit(f"ERROR: missing file {path}")
    with p.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise SystemExit(f"ERROR: expected list in {path}")
    return data

def main():
    parser = argparse.ArgumentParser(description="Validate two datasets are disjoint by id.")
    parser.add_argument("--a", required=True, help="First JSON list file")
    parser.add_argument("--b", required=True, help="Second JSON list file")
    parser.add_argument("--label-a", default="a")
    parser.add_argument("--label-b", default="b")
    parser.add_argument("--id-field", default="id")
    parser.add_argument("--max-examples", type=int, default=10)
    args = parser.parse_args()

    a = load_list(args.a)
    b = load_list(args.b)

    def ids(xs):
        out = set()
        for c in xs:
            if isinstance(c, dict):
                v = c.get(args.id_field)
                if v:
                    out.add(v)
        return out

    a_ids = ids(a)
    b_ids = ids(b)

    overlap = a_ids & b_ids
    if overlap:
        examples = list(overlap)[: args.max_examples]
        print(f"ERROR: {args.label_a}/{args.label_b} overlap: {len(overlap)}")
        print("examples:", examples)
        sys.exit(1)

    print(f"OK: {args.label_a}/{args.label_b} are disjoint")

if __name__ == "__main__":
    main()
