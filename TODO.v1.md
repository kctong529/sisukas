# v1.0.0 — Release Contract

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
  - current dataset contains only active/current offerings
  - historical DB contains all past + archived instances
  - disappearing instance -> archived to historical DB
  - reappearing instance -> marked active (history preserved)
* [ ] Verify that compiled metadata is used at runtime.
* [ ] Ensure existing plans are immune to upstream SISU data drift.

**Data invariants (runtime):**

* [ ] Active and historical datasets are disjoint by `instanceId` (after pruning overlaps).
  - historical may contain archived versions, but must not duplicate active `instanceId`s
* [ ] Unified course schema across all sources.
  - active, historical, and snapshots resolve into the exact same `Course` shape
  - runtime code does not rely on source-specific fields
* [ ] Runtime does not branch on data source to access core course fields

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

## 7. Infrastructure & Safety

* [ ] Add health check endpoint.
* [ ] Ensure prod and dev environments do not share test data.

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
* [ ] Tag and release `v1.0.0`
