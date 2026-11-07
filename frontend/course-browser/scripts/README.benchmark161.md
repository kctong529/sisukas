# Calendar study-group loading benchmark (#161)

This Playwright benchmark measures the time until the calendar is visible and until study-group data for the active plan is complete. It covers **cold load**, **reload**, and **warm navigation**. It is intended for reproducible local performance measurements, not load testing.

A **cold load** means a fresh browser context with stored summary cache keys cleared. It does **not** clear server-side, wrapper, or upstream SISU caches.

## Prerequisites

- Install frontend dependencies in `frontend/course-browser/` and install Playwright Chromium if needed: `npx playwright install chromium`.
- Set up a dedicated test account with a representative active study plan. Capture its login session as described below.
- Ensure the calendar exposes the completeness attributes expected by `scripts/benchmark-calendar.mjs`.
- Run the frontend and required backend services using the project's normal development setup. Confirm the frontend actually calls the intended `sisu-wrapper` instance.

### Authenticate Playwright before benchmarking

The benchmark does **not** log in automatically. It reuses the authenticated browser state produced by `scripts/capture-auth-state.mjs`. Capture this state once for each test account/environment, and recapture it if the session expires.

With the frontend running, from `frontend/course-browser/`:

```sh
SISUKAS_BASE_URL=https://localhost:5173 npm run test:e2e:auth:setup
```

1. The helper opens a **Playwright-controlled Chromium window**.
2. On the site, request a Better Auth magic link using a **dedicated test account** with a representative active plan.
3. Paste the magic-link URL into the **Playwright browser address bar**, not into the terminal or your normal browser.
4. On the **Verify your email** page, select **Sign In Now** and wait for the application to redirect.
5. Return to the terminal and press **Enter**. The helper checks that **Sign out** is visible, reloads the page, verifies the session again, and writes `playwright/.auth/test-user.json`.

The benchmark uses that file by default. To use another filename, set `SISUKAS_STORAGE_STATE` consistently for **both** the authentication helper and the benchmark. Use the same `SISUKAS_BASE_URL` as the benchmark; a session captured for a different origin may not authenticate the local frontend.

**Security:** The saved file contains active authentication state. Keep it private and untracked; never commit, upload, or share it. If the benchmark opens an unauthenticated session, rerun the capture helper before interpreting benchmark results.

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

The command exits with a nonzero status if any scenario is incomplete, partial, skipped, timed out, or otherwise unsuccessful. Inspect the JSON report for details.

The script records browser readiness, full-data completion, request counts, failures, and request timings. A fast `readyMs` is **not** equivalent to completed calendar loading; compare `completeMs` for runs whose status is `complete`.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `SISUKAS_BASE_URL` | `https://test.sisukas.eu` | Frontend URL |
| `SISUKAS_STORAGE_STATE` | `playwright/.auth/test-user.json` | Playwright authentication state |
| `SISUKAS_BENCH_RUNS` | `3` | Repetitions |
| `SISUKAS_BENCH_TIMEOUT_MS` | `120000` | Per-scenario timeout |
| `SISUKAS_BENCH_OUTPUT` | `test-results/benchmark161/results.json` | JSON results path |
| `SISUKAS_BENCH_IDLE_MS` | `1500` | Stability observation interval |
| `SISUKAS_BENCH_HEADED` | unset | Set to `1` to display the Playwright browser |

## Interpreting and sharing results

- Confirm each run completes with the expected number of active-plan offerings and no missing or failed data.
- Keep the active plan, API destinations, environment, concurrency, and location-enrichment configuration consistent when comparing runs.
- Use multiple repetitions to evaluate performance changes; a single run is preliminary.
- Profiling logs can be filtered with `grep 'perf161\.' /tmp/sisukas-161-wrapper.log`. Overlapping wrapper requests mean summed batch durations are not elapsed wall-clock time.
- Avoid uncontrolled load against upstream SISU APIs. Do not commit authentication state, credentials, raw logs, or benchmark output containing sensitive operational details; record aggregate results in issue #161.
