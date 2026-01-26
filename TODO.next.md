# Post–v1.0.0 Roadmap (Intentional, Non-Blocking)

> **Rule:**
> Nothing in this file blocks a release.
> These items represent **direction**, not commitment.

---

## Filtering & Rules Engine

* [ ] Must Rules UI for filtering engine.
* [ ] Performance benchmarking and tuning for Must Rules.
* [ ] Tag-based filtering.
* [ ] Advanced filter composition and presets.
* [ ] Course browser history mode (historical instances).

## Scheduling Algorithm

* [ ] Implement Hard Constraints component (validity tier).
* [ ] Cost function with user customization.
* [ ] Explainable ranking breakdown for schedule candidates.

## LEGO View (Persistence & Power-User Control)

* [ ] Block snapshot schema (full version).
* [ ] Persist blocks via backend.
* [ ] Disable previews after block removal.
* [ ] Handle officially cancelled study groups.

## Timeline Enhancements

* [ ] Timeline styling customization.
* [ ] Better density handling for heavy schedules.

## Favourites & Discovery

* [ ] Fuzzy search everywhere (list, timeline, LEGO).
* [ ] History-aware favourites view.
* [ ] Location-aware sorting and grouping.

## Feedback & Notes System

* [ ] Public feedback system for course instances.
  - user-bound public comments associated with a specific course instance
  - visible to other users
  - intended to inform planning decisions (e.g. perceived value, attendance expectations)
  - moderation and ranking out of scope for first iteration

* [ ] Private notes for favourites.
  - extend existing "note" field in favourites view
  - notes are private to the user
  - encrypt notes at rest (user-bound key)

* [ ] Clear separation between public feedback and private notes.
  - different schemas
  - different storage
  - different access rules

## Data & Infra Evolution

* [ ] Input validation and normalization layer.
* [ ] Cache lifecycle and invalidation strategy.
* [ ] Offline-first experiments.

## UX & Product Polish

* [ ] Accessibility improvements.
* [ ] Export / share views.
* [ ] Onboarding hints and guardrails.

## Documentation Expansion

* [ ] Detailed scheduling algorithm docs.
* [ ] API reference with examples.
* [ ] Contribution guide.
