# Observed SISU study-event API fixtures

Reduced JSON bodies derived from successful, unauthenticated Aalto Kori API
requests on **2026-10-27** (see `sisu-wrapper/requests.http`). They preserve
fields relevant to #89, not complete upstream schemas. No HTTP headers,
cookies, or user data are stored.

- `realisation.json`: Introduction to Space subgroup/event references.
- `weekly_lecture.json`: six expanded Monday lecture occurrences.
- `single_exam.json`: one non-recurring exam occurrence.
- `lecture_location.json` / `exam_location.json`: different rooms in the same
  building, with embedded building address and Finnish-only room names.

These observations **do not** establish the semantics of irregular locations,
rescheduling, exclusions, cancellations, or occurrence identity stability.
The tests document the observed shape and current client retrieval; they do
not validate live SISU responses or future transformation behavior.

**Follow-up:** The currently implemented `SisuClient.fetch_study_events()`
uses a comma-joined `id` query value for multiple IDs, while the manually
verified batch request used repeated `id` query parameters. Check whether
comma-separated IDs are supported before relying on batching; don't silently
change the client based on these fixtures alone.
