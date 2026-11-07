/* global process, console */
/** #161: browser performance baseline. No URLs, payloads, tokens or IDs in output. */
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const baseURL = process.env.SISUKAS_BASE_URL ?? 'https://test.sisukas.eu';
const origin = new URL(baseURL).origin;
const authPath = resolve(process.env.SISUKAS_STORAGE_STATE ?? 'playwright/.auth/test-user.json');
const outputPath = resolve(process.env.SISUKAS_BENCH_OUTPUT ?? 'test-results/benchmark161/results.json');
const repeats = Number(process.env.SISUKAS_BENCH_RUNS ?? 3);
const timeoutMs = Number(process.env.SISUKAS_BENCH_TIMEOUT_MS ?? 120_000);
const idleMs = Number(process.env.SISUKAS_BENCH_IDLE_MS ?? 1500);
const pollMs = 150;
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 20) throw Error('SISUKAS_BENCH_RUNS must be 1..20');
if (!Number.isInteger(timeoutMs) || timeoutMs < 5000) throw Error('SISUKAS_BENCH_TIMEOUT_MS must be an integer >= 5000');
if (!Number.isInteger(idleMs) || idleMs < 500 || idleMs > timeoutMs / 2) throw Error('SISUKAS_BENCH_IDLE_MS must be 500..timeout/2');
const wait = ms => new Promise(done => setTimeout(done, ms));
const round = value => value === null ? null : Math.round(value);
function percentile(numbers, fraction) {
  if (!numbers.length) return null;
  const values = [...numbers].sort((a, b) => a - b);
  const position = (values.length - 1) * fraction;
  const low = Math.floor(position); const high = Math.ceil(position);
  return round(values[low] + (values[high] - values[low]) * (position - low));
}
function summary(rows) {
  const times = rows.filter(x => x.status === 'complete').map(x => x.completeMs);
  return {
    runs: rows.length, completeRuns: times.length,
    medianCompleteMs: percentile(times, .5), p95CompleteMs: percentile(times, .95),
    medianObservationMs: percentile(rows.map(x => x.observedMs), .5),
    medianRequests: percentile(rows.map(x => x.studyGroup.requests), .5),
    timedOutRuns: rows.filter(x => x.status === 'timeout').length,
  };
}

// Clear only summary keys from the stored auth snapshot for cold runs.
// Each repetition uses a new context, but server-side caches are NOT reset.
const storageState = JSON.parse(await readFile(authPath, 'utf8'));
let removedSummaryKeys = 0;
for (const site of storageState.origins ?? []) {
  if (site.origin !== origin) continue;
  site.localStorage = (site.localStorage ?? []).filter(item => {
    if (!/study.?group/i.test(item.name)) return true;
    removedSummaryKeys++;
    return false;
  });
}

function watchRequests(page, clock) {
  const tracked = new Map();
  const pendingBodyReads = new Set();
  let lastActivityMs = clock();
  let active = 0;
  let peakActive = 0;
  let pageErrorCount = 0;
  const isRelevant = url => /\/api\/courses\/(?:batch\/)?study-groups(?:\?|$)/i.test(url);
  const addBodyRead = promise => {
    pendingBodyReads.add(promise);
    void promise.finally(() => pendingBodyReads.delete(promise));
  };
  function onRequest(req) {
    if (!isRelevant(req.url())) return;
    const record = {
      method: req.method(), startMs: clock(), responseMs: null, endMs: null,
      statusCode: null, state: 'pending', errorCategory: null,
      bodyBytes: null, contentLengthBytes: null,
    };
    tracked.set(req, record);
    active++; peakActive = Math.max(peakActive, active);
    lastActivityMs = clock();
  }
  function onResponse(response) {
    const record = tracked.get(response.request());
    if (!record) return;
    record.responseMs = clock();
    record.statusCode = response.status();
    const length = Number(response.headers()['content-length']);
    record.contentLengthBytes = Number.isFinite(length) && length >= 0 && response.headers()['content-length'] !== undefined ? length : null;
    lastActivityMs = clock();
  }
  function end(req, state, errorCategory = null) {
    const record = tracked.get(req);
    if (!record || record.state !== 'pending') return;
    record.endMs = clock(); record.state = state; record.errorCategory = errorCategory;
    active--; lastActivityMs = clock();
  }
  function onFinished(req) {
    const record = tracked.get(req);
    if (!record) return;
    end(req, 'finished');
    addBodyRead((async () => {
      try {
        const response = await req.response();
        if (response) record.bodyBytes = (await response.body()).byteLength;
      } catch { /* no payloads, and body collection is not a request failure */ }
    })());
  }
  function onFailed(req) {
    const message = req.failure()?.errorText ?? '';
    const category = /ERR_ABORTED|NS_BINDING_ABORTED|cancelled|canceled/i.test(message) ? 'aborted' : 'network';
    end(req, 'failed', category);
  }
  const onPageError = () => { pageErrorCount++; };
  page.on('request', onRequest);
  page.on('response', onResponse);
  page.on('requestfinished', onFinished);
  page.on('requestfailed', onFailed);
  page.on('pageerror', onPageError);
  return {
    get active() { return active; },
    get lastActivityMs() { return lastActivityMs; },
    async finish() {
      // Do not classify pending as failures or abort requests by closing the page.
      page.off('request', onRequest); page.off('response', onResponse);
      page.off('requestfinished', onFinished); page.off('requestfailed', onFailed);
      page.off('pageerror', onPageError);
      await Promise.allSettled([...pendingBodyReads]);
      const entries = [...tracked.values()].map(record => ({
        method: record.method, statusCode: record.statusCode,
        state: record.state, errorCategory: record.errorCategory,
        startMs: round(record.startMs), responseMs: round(record.responseMs),
        endMs: round(record.endMs),
        durationMs: record.endMs === null ? null : round(record.endMs - record.startMs),
        bodyBytes: record.bodyBytes, contentLengthBytes: record.contentLengthBytes,
      })).sort((a, b) => a.startMs - b.startMs);
      const completed = entries.filter(x => x.state === 'finished');
      const durations = completed.map(x => x.durationMs);
      return {
        requests: entries.length, finished: completed.length,
        httpErrors: completed.filter(x => x.statusCode >= 400).length,
        networkFailures: entries.filter(x => x.state === 'failed' && x.errorCategory === 'network').length,
        aborted: entries.filter(x => x.state === 'failed' && x.errorCategory === 'aborted').length,
        pendingAtEnd: entries.filter(x => x.state === 'pending').length,
        peakConcurrency: peakActive, pageErrorCount,
        totalDecodedBytes: completed.reduce((n, x) => n + (x.bodyBytes ?? 0), 0),
        durationMs: {min: durations.length ? Math.min(...durations) : null,
          median: percentile(durations, .5), p95: percentile(durations, .95),
          max: durations.length ? Math.max(...durations) : null},
        waterfall: entries,
      };
    },
  };
}

async function readState(page) {
  try {
    return await page.locator('.calendar-view').evaluate(el => {
      const d = el.dataset;
      const count = name => {
        const n = Number(d[name]);
        return Number.isFinite(n) && n >= 0 ? n : null;
      };
      return {
        plan: d.benchmarkPlan ?? 'unknown', status: d.benchmarkStatus ?? 'unknown',
        total: count('benchmarkTotal'), available: count('benchmarkAvailable'),
        stale: count('benchmarkStale'), missing: count('benchmarkMissing'),
        loading: count('benchmarkLoading'), failed: count('benchmarkFailed'),
        workspaceVisible: !!el.querySelector('.calendar-workspace'),
      };
    }, undefined, {timeout: 1000});
  } catch {
    return {plan: 'unknown', status: 'unknown', total: null, available: null,
      stale: null, missing: null, loading: null, failed: null, workspaceVisible: false};
  }
}
function verdict(state) {
  if (state.plan === 'error' || state.plan === 'none') return 'invalid-plan';
  if (state.plan !== 'active' || state.total === null || state.total === 0) return null;
  if (state.status === 'complete' && state.available === state.total &&
    state.loading === 0 && state.missing === 0 && state.failed === 0 && state.stale === 0) return 'complete';
  if ((state.loading === 0) && (state.failed > 0 || state.missing > 0 || state.stale > 0)) return 'partial';
  return null;
}

async function measure(page, label, action) {
  const start = performance.now();
  const clock = () => performance.now() - start;
  const watcher = watchRequests(page, clock);
  let readyMs = null; let completeMs = null; let status = 'timeout';
  let actionProblem = null;
  let lastState = null;
  try {
    await action();
    // Stay attached until full-data evidence stabilizes, or the timeout expires.
    // Merely disappearing loading text is NOT a completion signal.
    let candidate = null;
    while (clock() < timeoutMs) {
      lastState = await readState(page);
      if (readyMs === null && lastState.workspaceVisible) readyMs = clock();
      const current = verdict(lastState);
      if (current === 'invalid-plan') { status = current; break; }
      const quiet = watcher.active === 0 && clock() - watcher.lastActivityMs >= idleMs;
      if (current && quiet && lastState.workspaceVisible) {
        if (candidate?.status !== current) candidate = {status: current, at: clock()};
        if (clock() - candidate.at >= 250) {
          status = current;
          if (status === 'complete') completeMs = clock();
          break;
        }
      } else candidate = null;
      await wait(pollMs);
    }
  } catch (error) {
    status = 'action-error';
    // Omit the exception message: Playwright exceptions may contain URLs / identifiers.
    actionProblem = error?.name ?? 'Error';
  }
  const observedMs = clock();
  lastState = await readState(page);
  const studyGroup = await watcher.finish();
  const result = {
    scenario: label, status, problem: actionProblem, readyMs: round(readyMs),
    completeMs: round(completeMs), observedMs: round(observedMs),
    calendar: lastState, studyGroup,
  };
  console.log(`${label.padEnd(17)} ${status.padEnd(12)} ready=${String(result.readyMs).padStart(6)}ms complete=${String(result.completeMs).padStart(6)}ms observed=${String(result.observedMs).padStart(6)}ms requests=${studyGroup.requests} pending=${studyGroup.pendingAtEnd}`);
  return result;
}

const browser = await chromium.launch({headless: process.env.SISUKAS_BENCH_HEADED !== '1'});
const results = [];
try {
  for (let run = 1; run <= repeats; run++) {
    const context = await browser.newContext({baseURL, storageState, serviceWorkers: 'block'});
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);
    const nav = page.locator('nav.navbar');
    const calendar = nav.getByRole('button', {name: 'Weekly calendar'});
    const courses = nav.getByRole('button', {name: 'Browse courses'});
    try {
      const cold = await measure(page, 'cold', async () => {
        await page.goto('/');
        await calendar.waitFor({state:'visible'});
        await calendar.click();
      });
      results.push({run, ...cold});
      // Reload and warm-navigation scenarios are conditional on previous scenario
      // being complete. Otherwise they inherit unresolved work and bias the baseline.
      if (cold.status !== 'complete') {
        results.push({run, scenario: 'reload', status: 'skipped', reason: 'cold-incomplete'});
        results.push({run, scenario: 'warm-navigation', status: 'skipped', reason: 'cold-incomplete'});
        continue;
      }
      const reload = await measure(page, 'reload', async () => {
        await page.reload();
        await calendar.waitFor({state:'visible'});
        await calendar.click();
      });
      results.push({run, ...reload});
      if (reload.status !== 'complete') {
        results.push({run, scenario:'warm-navigation', status:'skipped', reason:'reload-incomplete'});
        continue;
      }
      results.push({run, ...await measure(page, 'warm-navigation', async () => {
        await courses.click();
        await calendar.click();
      })});
    } finally { await context.close(); }
  }
} finally { await browser.close(); }

const aggregate = Object.fromEntries(['cold','reload','warm-navigation'].map(name =>
  [name, summary(results.filter(row => row.scenario === name && row.status !== 'skipped'))]));
const report = {
  version: 2, generatedAt: new Date().toISOString(),
  environment: {baseOrigin: origin, repeats, timeoutMs, idleMs,
    browser:'chromium', serviceWorkers:'blocked', removedSummaryKeyCount: removedSummaryKeys,
    completenessSource:'CalendarProjectionResult.completeness'},
  summary: aggregate, results,
};
await mkdir(dirname(outputPath), {recursive:true});
await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
console.log(`\nWrote ${outputPath}\n${JSON.stringify(aggregate,null,2)}`);
// Incomplete, partial, skipped, and failed scenarios must not pass silently.
if (results.some(row => row.status !== 'complete')) process.exitCode = 1;
