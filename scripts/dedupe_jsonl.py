import json
import sys
from typing import Set


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: python dedupe_jsonl.py <input.jsonl> <output.jsonl>")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    seen: Set[str] = set()
    kept = 0
    skipped = 0

    with open(input_path, "r", encoding="utf-8") as fin, \
         open(output_path, "w", encoding="utf-8") as fout:

        for line_no, line in enumerate(fin, start=1):
            line = line.strip()
            if not line:
                continue

            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                print(f"Skipping invalid JSON on line {line_no}")
                skipped += 1
                continue

            cid = obj.get("id")
            if not isinstance(cid, str):
                skipped += 1
                continue

            if cid in seen:
                skipped += 1
                continue

            seen.add(cid)
            fout.write(json.dumps(obj, ensure_ascii=False) + "\n")
            kept += 1

    print("Dedupe completed.")
    print(f" Unique records kept: {kept}")
    print(f" Duplicates / skipped: {skipped}")


if __name__ == "__main__":
    main()
