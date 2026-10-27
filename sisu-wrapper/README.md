# Sisu Wrapper (v0.3.0)

A Python library and REST API for the Aalto University Sisu system. Access course data, schedules, and study groups programmatically or via HTTP endpoints.

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

**Sisu Wrapper** provides three ways to interact with Aalto University's course data:

1. **Python Library** – Import and use directly in your Python projects
2. **REST API** – Run as a web service with FastAPI for HTTP access
3. **Historical crawl utility (CLI)** – Build a historical course realisation dataset (resumable)

All components share the same robust core, providing clean access to course units, realisations, and study schedules.

## Features

### Core Functionality

* Fetch course units, offerings, and study groups
* Access lecture and exercise schedules
* Batch operations for efficient multi-course queries
* Connection pooling for efficient API usage
* Robust error handling
* Modern Python with type hints

### Python Library

* Zero dependencies except `requests`
* Clean, intuitive API
* Context manager support
* Comprehensive data models
* Batch request support

### Historical Records (New in v0.3.0)

* Fetch historical course unit realisations using the **unfiltered** Sisu endpoint
* Fetch detailed historical realisation records via Aalto Course API (API key via env var)
* **Append-only JSONL output** suitable for long-running crawls
* **Resumable crawling** with checkpoint state file
* Output designed for **downstream deduplication and normalization**

### REST API

* Fast and async with FastAPI
* Auto-generated interactive documentation
* Request validation with Pydantic
* Structured error responses with proper HTTP codes
* Easy to deploy and integrate

## Quick Start

### As a Python Library

```python
from sisu_wrapper import SisuClient, SisuService

with SisuClient(timeout=15) as client:
    service = SisuService(client)
    offering = service.fetch_course_offering(
        course_unit_id="aalto-OPINKOHD-1125839311-20210801",
        offering_id="aalto-CUR-206690-3122470"
    )
    print(offering.name)
```

### As a REST API

```bash
uvicorn api.main:app --reload
open http://localhost:8000/docs
```

## Historical Records CLI

The historical crawl exists to support features such as the **year timeline**, where users want to view and keep track of **past courses they have taken**. Sisu’s published APIs focus on current and upcoming teaching, and older course implementations may no longer be returned.

### Prerequisite: Course API key

Historical realisation details are fetched from Aalto Course API.

```bash
export AALTO_COURSE_API_KEY="..."
```

### Crawl historical realisations (resumable)

From the `sisu-wrapper/` directory:

```bash
python -m sisu_wrapper \
  --courses-json ../courses.json \
  --out ../historical_realisations.jsonl \
  --state ../historical_state.json
```

If interrupted with Ctrl+C, progress is saved automatically.

Resume later:

```bash
python -m sisu_wrapper \
  --courses-json ../courses.json \
  --out ../historical_realisations.jsonl \
  --state ../historical_state.json \
  --resume
```

### Output format

* The crawl produces **JSONL** (one record per line).
* Output is **append-only** by design.
* Duplicate records may appear if a crawl is resumed.

Deduplication and normalization are intentionally handled **outside of `sisu-wrapper`**, as downstream processing steps.

## REST API

### Running the API

```bash
uv run fastapi dev api/main.py --port 8001
```

### Example endpoint

```
GET /api/courses/study-groups?course_unit_id=<id>&course_offering_id=<id>
```

Interactive docs:

```
http://localhost:8001/docs
http://localhost:8001/redoc
```

## Development

### Architecture Overview

* `sisu_wrapper/client.py` – Low-level HTTP client for Sisu API
* `sisu_wrapper/service.py` – Business logic and orchestration
* `sisu_wrapper/models.py` – Domain dataclasses
* `sisu_wrapper/aalto_api_client.py` – Aalto Course API client (API key via env var)
* `sisu_wrapper/historical.py` – Historical discovery logic
* `sisu_wrapper/historical_parsing.py` – Typed parsing helpers
* `sisu_wrapper/models_historical.py` – Historical data models
* `sisu_wrapper/__main__.py` – CLI entry point for historical crawling

## Study-event metadata and rooms (unreleased #89)

Study events now preserve their source series ID, expanded occurrence times,
status (`cancelled`, `excluded`, `notice`) and effective location IDs.
Room and building enrichment is **opt-in**: by default it adds no extra SISU
requests. Both single and batch study-group REST endpoints accept
`resolve_locations=true`; Python consumers can use
`fetch_study_groups_with_locations()` or `resolve_study_group_locations()`.
Failure to resolve a room does not remove the scheduled event.

See the [study-event and location contract](https://github.com/kctong529/sisukas-docs/blob/main/content/dev-guide/study-event-contract.md) for
identity limitations, timezone assumptions, example payload semantics and
verified versus provisional behavior. Manual API examples are in
[`examples/requests.http`](examples/requests.http).

## Limitations

* **Room metadata is optional**: Source location IDs are preserved, but resolved room/building details require opting in and depend on public SISU lookups.
* **Live vs historical split**: Published Sisu endpoints only return recent offerings.
* **Read-only**: This wrapper does not modify data.
* **Rate limiting**: No built-in rate limiting; be respectful of upstream APIs.

## Requirements

* Python 3.10+
* requests >= 2.32.5

### Optional extras

```bash
uv pip install "sisu-wrapper[api]"
```

## Version History

### v0.3.0

* ✨ **New**: Historical course realisation crawling via `python -m sisu_wrapper`
* ✨ **New**: Aalto Course API client (API key via `AALTO_COURSE_API_KEY`)
* ✨ **New**: Unfiltered realisations fetch (`/course-unit-realisations`)
* ✨ **New**: Resumable, append-only JSONL crawl output
* 🔧 **Improved**: StudyEvent datetime parsing with Helsinki timezone fallback

### v0.2.0

* ✨ **New**: Batch request support
* 🔧 **Refactor**: Router-based API architecture
* 📝 **Breaking**: `/api/courses/` namespace introduced

## License

MIT License. See the [LICENSE](LICENSE) file for details.
