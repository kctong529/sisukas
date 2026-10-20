# Curriculum catalogue verification

These **development scripts** help verify the 2026–2028 Aalto curriculum catalogue for [issue #114](https://github.com/kctong529/sisukas/issues/114). They do not update the frontend curriculum YAML or approve any entry automatically.

## Repository paths

- Curated source of truth: `data/curricula/catalogue-reviewed.csv` (mixed reviewed and pending candidates)
- Scripts: `scripts/curricula/`
- Disposable reports and HTML cache: `scripts/curricula/.cache/` (keep out of Git)
- Frontend YAML validation: `frontend/course-browser/scripts/validate-curricula.ts` (separate purpose)

Run all commands from the **Sisukas repository root**.

## Setup

```sh
python3 -m venv .venv-curricula
source .venv-curricula/bin/activate
python -m pip install -r scripts/curricula/requirements.txt
```

For the offline commands below, only the Python standard library is necessary. `requests` and `beautifulsoup4` are needed for `--fetch`.

## Offline audit

```sh
python3 scripts/curricula/verify_catalogue.py
python3 scripts/curricula/generate_checklist.py
```

The verifier writes `scripts/curricula/.cache/verification.csv` and `REPORT.md`; the checklist generator writes `CHECKLIST.md` there. **No source file is modified.**

## Fetch official source pages

Start small:

```sh
python3 scripts/curricula/verify_catalogue.py --fetch --limit 3
```

Then, if the retrieval results look sensible:

```sh
python3 scripts/curricula/verify_catalogue.py --fetch
```

Downloaded HTML is cached in `scripts/curricula/.cache/html-cache/`; the default delay is one second per uncached URL. You can override `--input`, `--output`, `--limit`, `--delay` and `--timeout`. The tool only fetches individual or programme pages from Aalto's official domain. Its name/code/year matching works across the *whole page*, so matches on a shared programme page are **leads for manual verification, not proof**.

The verifier uses the **proposed** source URL and module code for its machine-evidence checks; verified fields copied into output remain human decisions. To check an improved source or code, update the proposed fields in the reviewed catalogue only after confirming your change, or use `--input` with a separate candidate CSV.

## Manual verification

Review the exact module section on the official Aalto page, checking identity, code, curriculum period, level and duplicate/translation status. In `data/curricula/catalogue-reviewed.csv`, use:

| Column | Value |
| --- | --- |
| `review_decision` | `include`, `exclude`, `merge`, `defer`, or empty if not reviewed |
| `verified_code` | Confirmed official module code, or blank with explanation |
| `verified_source_url` | Specific official source page or anchor |
| `verified_period` | e.g. `2026-2028` |
| `review_notes` | Evidence, ambiguity or merge destination |
| `reviewed_on` | Actual manual review date, ISO `YYYY-MM-DD` |

For duplicates, name the retained `record_id` in the notes. For excluded/discontinued curricula, **retain the row** so the decision remains auditable. Never replace the curated CSV with machine-generated `verification.csv`.

## Tests

```sh
python3 -m unittest discover -s scripts/curricula -p 'test_*.py' -v
```

The tests use temporary fixtures and do not require network access or the real catalogue.

## Git hygiene and documentation

Do not commit HTML caches or generated verification reports. Place the catalogue in `data/curricula/`, scripts here, and the maintenance guide in the separate `sisukas-docs` repository at `content/dev-guide/curriculum-metadata.md`.

For a new curriculum period, preserve existing reviews and record new candidates rather than erasing historical decisions.
