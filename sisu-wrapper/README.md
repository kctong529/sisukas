# Sisu Wrapper

A Python library and REST API for the Aalto University Sisu system. Access course data, schedules, and study groups programmatically or via HTTP endpoints.

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

**Sisu Wrapper** provides two ways to interact with Aalto University's course data:

1. **Python Library** - Import and use directly in your Python projects
2. **REST API** - Run as a web service with FastAPI for HTTP access

Both components share the same robust core, providing clean access to course units, realisations, and study schedules.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Python Library](#python-library)
- [REST API](#rest-api)
- [Development](#development)
- [Limitations](#limitations)
- [Requirements](#requirements)


## Features

### Core Functionality
- Fetch course units, offerings, and study groups
- Access lecture and exercise schedules
- Batch operations for efficient multi-course queries
- Connection pooling for efficient API usage
- Robust error handling
- Modern Python with type hints

### Python Library
- Zero dependencies except `requests`
- Clean, intuitive API
- Context manager support
- Comprehensive data models
- Batch request support

### REST API
- Fast and async with FastAPI
- Auto-generated interactive documentation
- Request validation with Pydantic
- Structured error responses with proper HTTP codes
- Easy to deploy and integrate


## Quick Start

### As a Python Library

```python
from sisu_wrapper import SisuClient, SisuService, SisuAPIError

# Initialize
client = SisuClient(timeout=15)
service = SisuService(client)

try:
    # Fetch course data
    offering = service.fetch_course_offering(
        course_unit_id="aalto-OPINKOHD-1125839311-20210801",
        offering_id="aalto-CUR-206690-3122470"
    )
    
    print(f"Course: {offering.name}")
    for group in offering.study_groups:
        print(f"  {group.type}: {group.name}")
        
finally:
    client.close()
```

### As a REST API

```bash
# Start the server
uvicorn api.main:app --reload

# Fetch study groups
curl "http://localhost:8000/api/courses/study-groups?course_unit_id=...&course_offering_id=..."

# API documentation
open http://localhost:8000/docs
```


## Python Library

### Installation

```sh
pip install sisu-wrapper
```

For development:

```sh
git clone https://github.com/kctong529/sisukas.git
cd sisukas/sisu-wrapper
pip install -e ".[dev]"
```

### Usage

#### Basic Example

```python
from sisu_wrapper import SisuClient, SisuService, SisuAPIError

# Initialize client with custom timeout
client = SisuClient(timeout=15)
service = SisuService(client)

try:
    # Fetch complete course offering data
    offering = service.fetch_course_offering(
        course_unit_id="aalto-OPINKOHD-1125839311-20210801",
        offering_id="aalto-CUR-206690-3122470"
    )
    
    print(f"Course: {offering.name}")
    print(f"Total study groups: {len(offering.study_groups)}")
    
    # Filter by group type
    lectures = offering.get_groups_by_type("Lecture")
    exercises = offering.get_groups_by_type("Exercise")
    
except SisuAPIError as e:
    print(f"API Error: {e}")
finally:
    client.close()
```

#### Working with Study Events

```python
# Get all events from a study group
for group in groups:
    for event in group.sorted_events:
        # Access as datetime objects
        start = event.start_datetime
        end = event.end_datetime
        
        # Or use the formatted representation
        print(event)  # "24.02.2026 (Tue) 12:15 - 14:00"
        
        # Raw ISO strings are also available
        print(event.start)  # "2026-02-24T12:15:00+02:00"
```

#### Batch Operations

```python
# Fetch multiple courses efficiently
batch_requests = [
    ("aalto-OPINKOHD-1125839311-20210801", "aalto-CUR-206690-3122470"),
    ("otm-e737f80e-5bc4-4a34-9524-8243d7f9f14a", "aalto-CUR-206050-3121830"),
]

results = service.fetch_study_groups_batch(batch_requests)

for (unit_id, offering_id), groups in results.items():
    print(f"{unit_id}: {len(groups)} study groups")
```

#### Context Manager (Recommended)

```python
with SisuClient() as client:
    service = SisuService(client)
    groups = service.fetch_study_groups(
        "aalto-OPINKOHD-1125839311-20210801",
        "aalto-CUR-206690-3122470"
    )
    # Connection automatically closed
```

### API Reference

#### `SisuClient`

Low-level HTTP client for the Sisu API.

**Constructor:**
```python
SisuClient(base_url: str | None = None, timeout: int = 10)
```

**Methods:**
- `fetch_course_unit(course_unit_id: str) -> Dict` - Fetch course unit metadata
- `fetch_course_realisations(assessment_item_id: str) -> List[Dict]` - Fetch course realisations
- `fetch_study_events(study_event_ids: List[str]) -> List` - Fetch study events
- `fetch_course_units_batch(course_unit_ids: List[str]) -> Dict` - Batch fetch course units
- `fetch_course_realisations_batch(assessment_item_ids: List[str]) -> Dict` - Batch fetch realisations
- `close()` - Close the session

#### `SisuService`

High-level service for working with course data.

**Constructor:**
```python
SisuService(client: SisuClient)
```

**Methods:**
- `fetch_course_offering(course_unit_id: str, offering_id: str) -> CourseOffering` - Fetch complete course data
- `fetch_study_groups(course_unit_id: str, offering_id: str) -> List[StudyGroup]` - Fetch only study groups
- `fetch_course_offerings_batch(requests: List[Tuple[str, str]]) -> Dict` - Batch fetch complete offerings
- `fetch_study_groups_batch(requests: List[Tuple[str, str]]) -> Dict` - Batch fetch study groups

#### Data Models

**`StudyEvent`**
```python
@dataclass
class StudyEvent:
    start: str                           # ISO format datetime
    end: str                             # ISO format datetime
    start_datetime: datetime             # Property: parsed datetime
    end_datetime: datetime               # Property: parsed datetime
```

**`StudyGroup`**
```python
@dataclass
class StudyGroup:
    group_id: str                        # Unique group ID
    name: str                            # Group name (e.g., "L01")
    type: str                            # Group type (e.g., "Lecture")
    study_events: List[StudyEvent]       # List of events
    sorted_events: List[StudyEvent]      # Property: events sorted by time
```

**`CourseOffering`**
```python
@dataclass
class CourseOffering:
    course_unit_id: str                  # Course unit ID
    offering_id: str                     # Offering/realisation ID
    name: str                            # Course name
    assessment_items: List[str]          # Assessment item IDs
    study_groups: List[StudyGroup]       # All study groups
    
    get_groups_by_type(type: str) -> List[StudyGroup]  # Filter by type
```


## REST API

### Running the API

```bash
# Development
uvicorn api.main:app --reload

# Production
uvicorn api.main:app --host 0.0.0.0 --port 8000
```

### Endpoints

#### Get API Metadata
```
GET /
```

Returns API version, environment, and available endpoints.

#### Fetch Study Groups
```
GET /api/courses/study-groups?course_unit_id=<id>&course_offering_id=<id>
```

Fetch all study groups (lectures, exercises, etc.) for a course offering.

**Parameters:**
- `course_unit_id` (string, required) - The course unit ID
- `course_offering_id` (string, required) - The course offering ID

**Response:**
```json
{
    "course_unit_id": "aalto-OPINKOHD-1125839311-20210801",
    "course_offering_id": "aalto-CUR-206690-3122470",
    "study_groups": [
        {
            "group_id": "...",
            "name": "L01",
            "type": "Lecture",
            "study_events": [...]
        }
    ]
}
```

#### Batch Fetch Study Groups
```
POST /api/courses/batch/study-groups
```

Fetch study groups for multiple course offerings in a single request.

**Request Body:**
```json
{
    "requests": [
        {
            "course_unit_id": "aalto-OPINKOHD-1125839311-20210801",
            "course_offering_id": "aalto-CUR-206690-3122470"
        },
        {
            "course_unit_id": "otm-e737f80e-5bc4-4a34-9524-8243d7f9f14a",
            "course_offering_id": "aalto-CUR-206050-3121830"
        }
    ]
}
```

**Response:**
```json
{
    "results": {
        "aalto-OPINKOHD-1125839311-20210801:aalto-CUR-206690-3122470": [...],
        "otm-e737f80e-5bc4-4a34-9524-8243d7f9f14a:aalto-CUR-206050-3121830": [...]
    },
    "total_requests": 2
}
```

#### Batch Fetch Course Offerings
```
POST /api/courses/batch/offerings
```

Fetch complete course offering data for multiple courses (includes all study groups and events).

**Request Body:** Same format as batch study groups endpoint.

**Response:**
```json
{
    "results": {
        "course_unit_id:offering_id": {
            "course_unit_id": "...",
            "offering_id": "...",
            "name": "...",
            "study_groups": [...]
        }
    },
    "total_requests": 2
}
```

### Error Responses

All endpoints return consistent error responses:

```json
{
    "detail": "Course not found"
}
```

**HTTP Status Codes:**
- `200` - Success
- `404` - Course not found
- `422` - Invalid request (validation error)
- `500` - Server error
- `502` - Sisu API unavailable
- `504` - Sisu API timeout

### Interactive Documentation

The API includes auto-generated interactive documentation:

```
http://localhost:8000/docs  # Swagger UI
http://localhost:8000/redoc  # ReDoc
```

Use these to explore endpoints, test requests, and view complete response schemas.


## Development

### Architecture Overview

The library follows a layered architecture:

- **`sisu_wrapper/client.py`** - Low-level HTTP communication with Sisu API
- **`sisu_wrapper/service.py`** - Business logic and orchestration
- **`sisu_wrapper/models.py`** - Domain objects (dataclasses)
- **`sisu_wrapper/exceptions.py`** - Custom error types
- **`api/routers/courses.py`** - FastAPI endpoints for course operations
- **`api/routers/root.py`** - FastAPI root endpoint with metadata
- **`api/main.py`** - FastAPI application setup
- **`api/models.py`** - Shared API models
- **`api/utils/responses.py`** - Response definitions and error handling

### Project Structure

```
sisu-wrapper/
├── sisu_wrapper/              # Python library (core package)
│   ├── __init__.py            # Package exports
│   ├── client.py              # HTTP client
│   ├── service.py             # Business logic
│   ├── models.py              # Data models
│   └── exceptions.py          # Custom exceptions
├── api/                       # FastAPI application
│   ├── core/
│   │   └── config.py          # Configuration
│   ├── routers/
│   │   ├── courses.py         # Course endpoints
│   │   └── root.py            # Root endpoint
│   ├── utils/
│   │   └── responses.py       # Response definitions
│   ├── models.py              # Shared API models
│   └── main.py                # FastAPI app
├── tests/                     # Test suite
│   └── test_client.py         # Client unit tests
├── examples/                  # Usage examples
│   └── demo.py                # Library and batch examples
├── pyproject.toml             # Package configuration
└── README.md                  # This file
```

### Code Quality

- **Type hints**: Full type annotation coverage for better IDE support
- **Documentation**: Comprehensive module, function, and endpoint docstrings
- **Error handling**: Custom exception hierarchy for granular error handling
- **Logging**: Structured logging throughout with configurable levels
- **Testing**: Unit tests with pytest and mock objects
- **Standards**: Follows PEP 8 and modern Python best practices
- **API Documentation**: Auto-generated Swagger UI with complete endpoint documentation

### Running Tests

```sh
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Run with verbose output
pytest -v

# Run with coverage
pytest --cov=sisu_wrapper

# Run specific test file
pytest tests/test_client.py
```


## Finding Course IDs

Course unit IDs and offering IDs can be found in `courses.json`:

```json
{
    "id": "aalto-CUR-206690-3122470",
          └───────────┬────────────┘
              offering_id
    "code": "MS-A0108",
    "startDate": "2026-02-23",
    "endDate": "2026-04-17",
    "courseUnitId": "aalto-OPINKOHD-1125839311-20210801",
                    └─────────────────┬────────────────┘
                           course_unit_id
    "enrolmentStartDate": "2026-01-26",
    "enrolmentEndDate": "2026-03-02"
}
```


## Limitations

- **No location data**: Venue/room information is not available through the public API. Multiple events with identical times typically indicate different exam venues.
- **Recent offerings only**: The published realisations endpoint only returns upcoming or recently active offerings. Historical data requires different endpoints.
- **Read-only**: This wrapper only supports fetching data, not modifying it.
- **Rate limiting**: No built-in rate limiting - be respectful of the Sisu API
- **Batch size**: Batch requests are limited to 100 items per request


## Requirements

- Python 3.10+
- requests >= 2.32.5

### Development Requirements

- pytest >= 7.0
- fastapi >= 0.100
- uvicorn >= 0.23


## Version History

### v0.2.0

- ✨ **New**: Batch request support for efficient multi-course queries
- 🔧 **Refactor**: Router-based API architecture with professional documentation
- 📝 **Breaking**: Endpoint URLs changed (`/api/courses/` namespace added)
- 📚 **Improved**: Complete API documentation with Swagger UI

### v0.1.0

- Initial release
- Core library functionality
- Basic FastAPI endpoints


## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.