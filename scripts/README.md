# Course catalog scripts

Run the commands below from the **repository root**. These are the dataset tools
used by `.github/workflows/check_course_updates.yml`; they do not publish to
GCS when run locally.

## Inputs and contract

- `courses.json`: previously published **active** catalog (not the newest API
  response). Use a trusted, backed-up pre-incident copy when repairing data.
- `latest.json`: freshly transformed Aalto Open API output, normalized to the
  sisukas catalog format.
- Both must be JSON arrays with unique implementation IDs; the catalog
  validator also checks the complete published record schema.
- `startDate` and `endDate` are required `YYYY-MM-DD` strings. Enrolment dates
  may be `null`; supported upstream timestamps are normalized earlier in the
  pipeline by `course_dates.py`.

A normal local sequence is:

```bash
python3 -m pip install requests 'jsonschema>=4.18,<5'
python3 scripts/transform_courses.py latest_fetch.json latest.json
python3 scripts/validate_course_catalog.py courses.json
python3 scripts/validate_course_catalog.py latest.json
mkdir -p artifacts
python3 scripts/reconcile_active_courses.py \
  --previous courses.json \
  --latest latest.json \
  --active-out artifacts/courses.next.json \
  --archive-out artifacts/archive_candidates.json \
  --retained-out artifacts/carried_forward.json \
  --max-archive-fraction 0.20
python3 scripts/validate_course_catalog.py artifacts/courses.next.json
```

`reconcile_active_courses.py --help` describes each argument. Its default
`--as-of` is **today in UTC**; use `--as-of YYYY-MM-DD` to reproduce an earlier
update consistently. The script fails without writing new outputs if the
latest catalog is empty, IDs are malformed/duplicated, a disappearing record
has an invalid end date, or the archive fraction exceeds the configured limit.

## Reconciliation outputs

| File | Meaning |
| --- | --- |
| `courses.next.json` | Proposed active catalog: latest records plus previous records missing upstream with `endDate >= --as-of`. |
| `archive_candidates.json` | Previous records missing upstream whose `endDate < --as-of`. **Candidates**, not independently confirmed expirations. |
| `carried_forward.json` | Diagnostics for missing current/future implementations preserved in active. |

An implementation present in `latest.json` always uses that newer record. The
three outputs are prepared together, but file replacement is not an atomic
multi-file transaction. Do not treat these files alone as approval to publish.

## Exceptional archive threshold override

The scheduled workflow enforces `--max-archive-fraction 0.20`, meaning that
more than 20% of the *previous active* catalog becoming archive candidates
stops the run. An exception should be **manual and reviewed**; never edit out
the threshold to unblock routine updates.

1. Back up the **currently published** `courses.json`, `historical.json`, and
   corresponding `.hash.json` objects (retain their GCS generations).
2. Reconcile locally using the same baseline as the intended publication;
   review `archive_candidates.json` and `carried_forward.json`, their counts,
   and the proposed historical merge. Validate final active/historical catalogs
   and disjointness before approving any upload.
3. For a local reviewed run, explicitly approve the exact count:

   ```bash
   python3 scripts/reconcile_active_courses.py \
     --previous courses.json --latest latest.json \
     --active-out artifacts/courses.next.json \
     --archive-out artifacts/archive_candidates.json \
     --retained-out artifacts/carried_forward.json \
     --max-archive-fraction 0.20 \
     --allow-large-archive --expected-archive-count 4864
   ```

   **4864 is only the observed 20 October 2026 example using the 8,321-record
   pre-incident baseline and `--as-of 2026-10-20`.** Do not reuse this number
   against a different baseline or date. A mismatch fails the run.
4. In GitHub Actions, choose **Check Course Updates → Run workflow** on the
   intended branch, enable `allow_large_archive`, and enter the reviewed
   integer in `expected_archive_candidates`. A scheduled or push-triggered run
   cannot supply an override. The production bucket is selected only for the
   `main` branch; other branches select `sisukas-core-test`.
5. Review the entire workflow run before treating its output as repaired.
   Passing the count guard does **not** prove missing records were correctly
   classified; a deliberate run may still publish many historical changes.

**Important:** The workflow fetches its previous catalogs from the selected
bucket. If production was already modified by the incident, that previous
catalog may *not* be the 8,321-record baseline; the archive count (and repair
result) can differ. Restore or explicitly stage a trusted baseline through a
reviewed recovery procedure first. The GitHub Actions override is not a
replacement for reconciliation or rollback planning. Catalog and hash uploads
are separate GCS operations, not an atomic release.

## Verification

```bash
python3 -m unittest discover -s scripts/tests -p 'test_*.py' -v
python3 scripts/validate_course_catalog.py artifacts/courses.next.json
```

Before production publication, also validate the merged historical output and
run `scripts/validate_disjoint_datasets.py` on the proposed active and
historical files. See [issue #120](https://github.com/kctong529/sisukas/issues/120)
for the date-format hotfix and [issue #64](https://github.com/kctong529/sisukas/issues/64)
for longer-term dataset transition safety.
