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

* [ ] Build historical course instance database via SISU historical endpoint ingestion script.
* [ ] Update data workflow to keep `courses.json` and historical DB in sync.
  - current dataset contains only active/current offerings
  - historical DB contains all past instances + archived instances
  - disappearing instance → archive to historical DB
  - reappearing instance → mark active, do not delete history
* [ ] Verify that compiled metadata is actually used at runtime.
* [ ] Ensure existing plans are immune to upstream data drift.

## 2. Transcript Import & Grades

* [ ] Import transcript (courses → plan).
* [ ] Import grades from transcript into timeline model.
* [ ] Allow **manual grade input and edits** (independent of transcript import).

## 3. Core Domain Consistency

* [ ] Clean up and centralize the core data model.
  - plans
  - study groups
  - schedule pairs
  - blocks (minimal representation)
* [ ] Define a single, explicit source of truth for the active plan.

## 4. Timeline (Release-Critical UI)

* [ ] Generate timeline from schedules (prefer historical instances when available).
* [ ] Support multiple academic years.
* [ ] Compact, readable, color-coded layout.
* [ ] Display grades correctly across years.

## 5. Plan Management

* [ ] Edit plan name.
* [ ] Remove plan.
* [ ] Fix favourites ↔ plan inconsistency (removal propagates correctly).
* [ ] Deterministic sorting rule for favourites (clearly defined).

## 6. Authentication Enforcement

* [ ] Ensure all plan- and schedule-mutating endpoints require authentication.
* [ ] Verify no unauthenticated writes are possible.

## 7. Infrastructure & Safety

* [ ] Add health check endpoint.
* [ ] Ensure prod and dev environments do not share test data.

---

## Release Checklist

* [ ] No upstream drift affecting existing plans
* [ ] Timeline and schedule data agree
* [ ] Transcript import works end-to-end
* [ ] Manual grade edits persist correctly
* [ ] Auth enforced everywhere it should be
* [ ] Tag and release `v1.0.0`
