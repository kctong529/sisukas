# Calendar study-group loading benchmark (#161)

This Playwright benchmark measures the time until the calendar is visible and until study-group data for the active plan is complete. It covers **cold load**, **reload**, and **warm navigation**. It is intended for reproducible local performance measurements, not load testing.

## Prerequisites

- Install frontend dependencies in `frontend/course-browser/` and install Playwright Chromium if needed: `npx playwright install chromium`.
- Set up a test account with a representative active study plan. Generate Playwright authentication state using `npm run test:e2e:auth:setup`. Keep `playwright/.auth/test-user.json` private and untracked.
- Ensure the calendar exposes the completeness attributes expected by `scripts/benchmark-calendar.mjs`.
- Run the frontend and required backend services using the project's normal development setup. Confirm the frontend actually calls the intended `sisu-wrapper` instance.

### Local wrapper (optional profiling)

To capture wrapper timings, start the wrapper from `sisu-wrapper/` with its configured SISU credentials:

```sh
source .venv/bin/activate
# One-time setup, if needed: uv pip install -e '.[api,dev]'
SISUKAS_PROFILE_STUDY_GROUPS=1 \
python -m uvicorn main:app --app-dir api \
  --host 127.0.0.1 --port 8001 --workers 1 --log-level info \
  2>&1 | tee /tmp/sisukas-161-wrapper.log
```

For the local frontend, configure `VITE_WRAPPER_API=http://127.0.0.1:8001` in `frontend/course-browser/.env`, and restart Vite. In the observed development setup, port `8000` is used by the filters API, while `8001` is used by `sisu-wrapper`.

## Run the benchmark

From `frontend/course-browser/`:

```sh
SISUKAS_BASE_URL=https://localhost:5173 \
SISUKAS_BENCH_RUNS=3 \
SISUKAS_BENCH_TIMEOUT_MS=120000 \
SISUKAS_BENCH_OUTPUT=/tmp/sisukas-161/results.json \
node scripts/benchmark-calendar.mjs
```

Inspect the summary:

```sh
jq '.summary' /tmp/sisukas-161/results.json
```

The script records browser readiness, full-data completion, request counts, failures, and request timings. A fast `readyMs` is **not** equivalent to completed calendar loading; compare `completeMs` for runs whose status is `complete`.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `SISUKAS_BASE_URL` | `https://test.sisukas.eu` | Frontend URL |
| `SISUKAS_STORAGE_STATE` | `playwright/.auth/test-user.json` | Playwright authentication state |
| `SISUKAS_BENCH_RUNS` | `3` | Repetitions |
| `SISUKAS_BENCH_TIMEOUT_MS` | `90000` | Per-scenario timeout; use a longer limit for slow baselines |
| `SISUKAS_BENCH_OUTPUT` | `test-results/benchmark161/results.json` | JSON results path |
| `SISUKAS_BENCH_IDLE_MS` | `1500` | Stability observation interval |
| `SISUKAS_BENCH_HEADED` | unset | Set to `1` to display the Playwright browser |

## Interpreting and sharing results

- Confirm each run completes with the expected number of active-plan offerings and no missing or failed data.
- Keep the active plan, API destinations, environment, concurrency, and location-enrichment configuration consistent when comparing runs.
- Use multiple repetitions to evaluate performance changes; a single run is preliminary.
- Profiling logs can be filtered with `grep 'perf161\.' /tmp/sisukas-161-wrapper.log`. Overlapping wrapper requests mean summed batch durations are not elapsed wall-clock time.
- Avoid uncontrolled load against upstream SISU APIs. Do not commit authentication state, credentials, raw logs, or benchmark output containing sensitive operational details; record aggregate results in issue #161.
