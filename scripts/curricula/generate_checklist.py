#!/usr/bin/env python3
"""Create a human-readable checklist from the reviewed curriculum catalogue."""
import argparse
import csv
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=ROOT / 'data/curricula/catalogue-reviewed.csv')
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parent / '.cache' / 'CHECKLIST.md')
    args = parser.parse_args()
    with args.input.open(newline='', encoding='utf-8-sig') as handle:
        entries = list(csv.DictReader(handle))
    grouped = defaultdict(list)
    for row in entries:
        grouped[row.get('kind', 'unknown')].append(row)
    lines = ['# Curriculum catalogue review checklist', '',
             'This is a generated view. Make review decisions in `data/curricula/catalogue-reviewed.csv`.', '']
    for kind, rows in sorted(grouped.items()):
        lines.extend([f'## {kind} ({len(rows)})', ''])
        for row in rows:
            decision = row.get('review_decision','').strip()
            marker = 'x' if decision in ('include', 'merge', 'exclude') else ' '
            name = row.get('name','').replace('[','\\[').replace(']','\\]')
            code = row.get('verified_code','') or row.get('official_code','') or 'code pending'
            url = row.get('verified_source_url','') or row.get('source_url','')
            source = f' — [source]({url})' if url else ''
            label = f' — {decision}' if decision else ''
            lines.append(f'- [{marker}] {name} (`{code}`){label}{source}')
        lines.append('')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    if args.output.resolve() == args.input.resolve(): parser.error('Output cannot overwrite input')
    args.output.write_text('\n'.join(lines), encoding='utf-8')
    print(f'Wrote {len(entries)} entries to {args.output}')


if __name__ == '__main__':
    main()
