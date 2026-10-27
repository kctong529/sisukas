# Observed SISU study-event API fixtures

Reduced JSON bodies derived from successful, unauthenticated Aalto Kori API
requests on **2026-10-27** (see `sisu-wrapper/examples/requests.http`). They preserve
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

The unversioned study-event endpoint supports both comma-separated IDs and repeated `id` parameters for the tested records. The existing wrapper uses the comma-separated format, which was verified successfully on 27 October 2026.

## Exceptional cases in tests

The exceptional-occurrence tests modify copies of `weekly_lecture.json` at
runtime. These cases are **synthetic** and do not claim to be captured from
SISU: mixed cancelled/excluded occurrences, notices, non-null room overrides
and empty room overrides. Real exceptions and rescheduling behavior remain
unverified. See the [contract documentation](https://github.com/kctong529/sisukas-docs/blob/main/content/dev-guide/study-event-contract.md).
