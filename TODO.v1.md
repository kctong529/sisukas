# v1.0.0 - Release Contract

> **Rule:**
> Everything in this file must be done before tagging `v1.0.0`.
> If something turns out to be larger than expected, it is **removed**, not half-finished.

---

## Goal

Ship a **trustworthy study planning tool**.

A student can:

* sign in,
* create and manage a plan,
* import transcript data,
* view a stable academic timeline with grades,
* and trust that plans do not break when upstream SISU data changes.

---

## 1. Data Truth & Drift Control (Hard Blockers)

* [x] Build historical course instance database via SISU historical endpoint ingestion script.
* [ ] Update data workflow to keep `courses.json` and historical DB in sync.
  - [x] `courses.json` contains only active course instances (current academic year onwards)
  - [x] `historical.json` is an append-only archive of instances that were previously present in `courses.json` (i.e. "once-active" instances)  
    - Note: this archive is not expected to be globally complete because SISU historical coverage cannot be ingested fully without extra permission.
  - [x] When an instance expires from `courses.json`, it is archived into `historical.json`
  - [ ] If an archived instance reappears as active, it is removed from `historical.json` and served only from `courses.json` (datasets remain disjoint by instanceId)
  - [x] Snapshot system captures missing course instances not present in `courses.json` or `historical.json`, including:
    - [x] transcript-only courses (no active offering observed)
    - [x] archived course with future offerings not yet visible in `courses.json`
  - [ ] Snapshots are a patch layer for runtime resolution; only pipeline-accepted candidates graduate into `historical.json`
* [ ] Implement snapshot backfill pipeline.
  - [ ] Collect runtime-resolved snapshots as append-only candidate records in GCS
  - [ ] Process candidates after fixed delay window (e.g. 24-48h) to absorb duplicates
  - [ ] Deduplicate and classify candidates (auto-acceptable vs. review-required)
  - [ ] Output accepted candidates for integration into historical dataset
* [ ] Integrate processed snapshots into historical dataset.
  - [ ] Merge accepted candidates into `historical.json` via scheduled job
  - [ ] Run existing dedup + validation workflow on merged result
  - [ ] Publish updated `historical.json` to GCS
* [ ] Ensure snapshot store remains non-canonical.
  - [ ] Snapshots have TTL and are never directly served as canonical data
  - [ ] User-triggered snapshots are marked temporary and clearly distinguished in UI
  - [ ] Pipeline acceptance is explicit and produces a concrete merge artifact (JSON) consumed by the historical merge job
  - [ ] Only pipeline-accepted snapshots graduate to `historical.json`
* [ ] Verify that compiled metadata is used at runtime.
  - [ ] Build step generates `metadata.json` from source YAML files
  - [ ] App loads `metadata.json` instead of individual YAML files (single request)
  - [ ] Metadata fields (organizations, periods, majors, minors) are validated against current `courses.json` and `historical.json`
  - [ ] No stale or missing values that would break UI filters or course resolution
* [ ] Implement data backup and rollback strategy.
  - [ ] `courses.json` and `historical.json` are versioned in GCS with timestamps before each publish
  - [ ] Backups are retained for at least 30 days
  - [ ] Rollback procedure is documented and tested (restore both files atomically)
  - [ ] Data validation failures in dedup/merge workflow block publication
  - [ ] Hash mismatch or validation error triggers alert
* [ ] Ensure existing plans are immune to upstream SISU data drift.

**Data invariants (runtime):**

* [x] Active and historical datasets are disjoint by `instanceId`.
  - [x] `courses.json` and `historical.json` share no overlapping `instanceId`s
  - [x] snapshot system bridges gaps in historical coverage for grade lookup and course resolution
* [x] Unified course schema across all sources.
  - [x] active, historical, and snapshots resolve into the exact same `Course` shape
  - [x] runtime code does not rely on source-specific fields
* [ ] Runtime does not branch on data source to access core course fields
* [ ] Snapshot store is signal, not source of truth.
  - [ ] All candidate data is append-only and time-partitioned
  - [ ] Backfill processing is deterministic and fully replayable
* [ ] Correctness is mandatory; completeness is best-effort.
  - [ ] Canonical datasets must be internally consistent and stable even if not globally complete

## 2. Transcript Import & Grades

* [x] Import transcript (courses → plan).
* [x] Import grades from transcript into timeline model.
* [x] Allow manual grade input and edits (independent of transcript import).
* [x] Resolve old course codes which are not found in existing databases.

## 3. Core Domain Consistency

* [ ] Clean up and centralize the core data model.
  - [x] plans
  - [ ] study groups
  - [ ] schedule pairs
  - [ ] blocks
  - [x] course index (active, historical, and snapshots)
* [x] Enforce active-plan invariant:
  - [x] exactly one active plan exists per user when at least one plan exists
  - [x] active plan selection is deterministic and stable across reloads
  - [x] frontend state always reflects backend active plan

## 4. Timeline (Release-Critical UI)

* [x] Generate timeline from schedules.
* [x] Support multiple academic years.
* [x] Compact, readable, color-coded layout.
* [x] Display grades correctly across years.

## 5. Plan Management

* [x] Edit plan name.
* [x] Remove plan.
* [x] Fix favourites instance selection state stays consistent when switching plans (expanded/selected instance updates correctly).
* [x] Fix favourites: removing an instance from plan updates favourites UI immediately (no stale expanded/selected state).
* [x] Fix favourites: switching active plan resets/syncs expanded instance state deterministically.
* [x] Fix favourites: removing a planned instance propagates correctly (plan + favourites UI stay in sync).
* [ ] Deterministic sorting rule for favourites (clearly defined).

## 6. Authentication Enforcement

* [x] Ensure all plan- and schedule-mutating endpoints require authentication.
* [ ] Verify no unauthenticated writes are possible.
  - [ ] Add a CI job that runs a small script calling all mutating endpoints without cookies and expects 401/403

## 7. Infrastructure & Safety

* [ ] Add health check endpoint.
* [x] Prod bucket must be sisukas-core, test must be sisukas-core-test, enforced by workflow + runtime env.

## 8. UX Clarity

* [x] Key features have inline explanation
  - [x] Transcript Import modal includes: what input is expected + what is uploaded
  - [x] Schedule Optimizer modal includes: “How it works” section
  - [x] Missing course resolution explains: what happens when course not found

---

## Release Checklist

* [ ] No upstream drift affecting existing plans
* [ ] Timeline and schedule data agree
* [ ] Transcript import works end-to-end
* [ ] Manual grade edits persist correctly
* [ ] Auth enforced everywhere it should be
* [ ] Snapshot backfill pipeline processes candidates correctly
* [ ] Snapshot-derived data integrates cleanly into historical dataset
* [ ] Data backup and rollback procedure is tested
* [ ] At least one backup exists and can be restored
* [ ] Tag and release `v1.0.0`
