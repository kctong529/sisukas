# Sisu Wrapper (v0.5.0)

A Python library and REST API for Aalto University's SISU system. Access course data, teaching schedules, study groups, and room information programmatically or through HTTP endpoints.

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

**Sisu Wrapper** provides three ways to interact with Aalto University's course data:

1. **Python library** – Access SISU data directly from Python.
2. **REST API** – Expose course and teaching-event information through FastAPI.
3. **Historical crawl utility** – Collect historical course realisations using a resumable CLI.

The components share a common client and domain models.

## Features

### Core functionality

- Fetch course units, offerings, and study groups.
- Retrieve expanded teaching-event occurrences and their source series IDs.
- Preserve occurrence timestamps, cancellation status, and location references.
- Optionally resolve room names, building names, and addresses.
- Support batch requests and connection pooling.
- Handle upstream API errors through dedicated exceptions.

### Historical records

- Discover historical course realisations through the unfiltered SISU endpoint.
- Retrieve historical details using the Aalto Course API.
- Export append-only JSONL datasets.
- Resume interrupted crawls using checkpoint files.

## Quick Start

### Python library

Install the package in your environment:

```bash
pip install -e .
```

Fetch a course offering:

```python
from sisu_wrapper import SisuClient, SisuService

with SisuClient(timeout=15) as client:
    service = SisuService(client)

    offering = service.fetch_course_offering(
        course_unit_id="aalto-CU-1151000764-20260801",
        offering_id="aalto-cur-P-c235941a-0fd6-11f1-8c99-0050569455c9",
    )

    print(offering.name)
```

Location resolution is optional:

```python
groups = service.fetch_study_groups_with_locations(
    course_unit_id="aalto-CU-1151000764-20260801",
    offering_id="aalto-cur-P-c235941a-0fd6-11f1-8c99-0050569455c9",
)

for group in groups:
    for event in group.study_events:
        print(event.start, event.locations)
```

Unresolved study events retain their source location IDs. Failed location lookups do not prevent schedule retrieval.

### REST API

Install the optional API dependencies:

```bash
pip install -e ".[api,dev]"
```

Start the API from the `sisu-wrapper/` directory:

```bash
python -m uvicorn api.main:app --app-dir api --port 8001
```

Interactive documentation:

- Swagger UI: http://localhost:8001/docs
- ReDoc: http://localhost:8001/redoc

Fetch study groups:

```http
GET /api/courses/study-groups?course_unit_id=<id>&course_offering_id=<id>
```

Include room/building metadata:

```http
GET /api/courses/study-groups?course_unit_id=<id>&course_offering_id=<id>&resolve_locations=true
```

Both single and batch study-group endpoints support `resolve_locations`.

The parameter defaults to `false` to preserve existing behavior and avoid unnecessary upstream requests.

## Historical Records CLI

The historical crawler supports features such as the year timeline, where users may need course implementations that are no longer available through SISU's published-offering endpoints.

### Prerequisite

Historical realisation details are fetched through the Aalto Course API:

```bash
export AALTO_COURSE_API_KEY="..."
```

### Crawl historical realisations

From `sisu-wrapper/`:

```bash
python -m sisu_wrapper \
  --courses-json ../courses.json \
  --out ../historical_realisations.jsonl \
  --state ../historical_state.json
```

Resume an interrupted crawl:

```bash
python -m sisu_wrapper \
  --courses-json ../courses.json \
  --out ../historical_realisations.jsonl \
  --state ../historical_state.json \
  --resume
```

The crawler writes append-only JSONL records. Duplicate records may occur after resuming; downstream processing is responsible for deduplication and normalization.

## Development

### Project structure

- `sisu_wrapper/client.py` – Low-level SISU HTTP client.
- `sisu_wrapper/service.py` – Data transformation and orchestration.
- `sisu_wrapper/models.py` – Domain models.
- `sisu_wrapper/aalto_api_client.py` – Aalto Course API client.
- `sisu_wrapper/historical.py` – Historical realisation discovery.
- `sisu_wrapper/historical_parsing.py` – Historical data parsing.
- `sisu_wrapper/models_historical.py` – Historical models.
- `sisu_wrapper/__main__.py` – Historical crawler CLI.
- `api/` – FastAPI application and routers.
- `tests/` – Unit, contract, and API integration tests.
- `examples/requests.http` – Reproducible SISU and wrapper API requests.

### Testing

```bash
python -m pytest tests/ -v
```

### Documentation

Detailed API contracts, event identity semantics, location behavior, and known limitations are maintained in the [sisukas documentation repository](https://github.com/kctong529/sisukas-docs).

## Limitations

- **Occurrence identity:** SISU provides study-event series IDs, but individual occurrence IDs were not present in the examined responses. Rescheduling may affect derived occurrence keys.
- **Exceptional occurrences:** Cancellation and location-override fields are preserved, but some semantics remain unverified against real exceptional records.
- **Timezone handling:** Naive event timestamps are interpreted as Europe/Helsinki local time. Ambiguous daylight-saving transitions are not explicitly resolved.
- **Location availability:** Room/building resolution is best-effort and requires additional SISU requests.
- **Historical coverage:** Published-offering endpoints do not provide complete historical course coverage.
- **Read-only access:** The wrapper does not modify SISU data.
- **Rate limiting:** No built-in request rate limiter is provided.

## Requirements

- Python 3.10+
- `requests >= 2.32.5`

Optional API and development dependencies are available through package extras.

## Version History

### v0.5.0 — Study-event metadata and location resolution

- Preserve source study-event series IDs and occurrence status.
- Preserve effective location references for individual occurrences.
- Add optional room and building resolution using the SISU Kori API.
- Support `resolve_locations` on single and batch study-group endpoints.
- Preserve backward-compatible default behavior.
- Add API contract fixtures, exceptional-occurrence tests, and FastAPI integration tests.
- Document event identity, location semantics, and timezone limitations.

### v0.3.0 — Historical course realisations

- Add historical realisation crawling through `python -m sisu_wrapper`.
- Add the Aalto Course API client.
- Support unfiltered realisation discovery.
- Add resumable, append-only JSONL output.
- Improve `StudyEvent` datetime parsing with Helsinki timezone fallback.

### v0.2.0 — Batch operations

- Add batch request support.
- Refactor API into routers.
- Introduce the `/api/courses/` namespace.

## License

MIT License. See [LICENSE](LICENSE) for details.
