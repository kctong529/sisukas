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
- [Python Library](#python-library)
- [Development](#development)
- [Limitations](#limitations)
- [Requirements](#requirements)


## Features

### Core Functionality
- Fetch course units, offerings, and study groups
- Access lecture and exercise schedules
- Connection pooling for efficient API usage
- Robust error handling
- Modern Python with type hints

### Python Library
- Zero dependencies except `requests`
- Clean, intuitive API
- Context manager support
- Comprehensive data models

### REST API
- Fast and async with FastAPI
- Auto-generated interactive documentation
- Request validation with Pydantic
- Easy to deploy and integrate


## Python Library

### Installation

```sh
pip install sisu-wrapper
```

For development:

```sh
git clone https://github.com/kctong529/sisukas.git
cd sisu-wrapper
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


## Development

### Architecture Overview

The library follows a layered architecture:

- **`client.py`** - Low-level HTTP communication with Sisu API
- **`service.py`** - Business logic and orchestration
- **`models.py`** - Domain objects (dataclasses)
- **`exceptions.py`** - Custom error types

The FastAPI application (`api/`) is a thin wrapper that exposes the service layer via HTTP endpoints.

### Project Structure

```
sisu-wrapper/
├── sisu_wrapper/         # Python library (core package)
│   ├── __init__.py       # Package exports
│   ├── client.py         # HTTP client
│   ├── service.py        # Business logic
│   ├── models.py         # Data models
│   └── exceptions.py     # Custom exceptions
├── tests/                # Test suite
│   └── test_client.py    # Client unit tests
├── api/                  # FastAPI application
│   ├── __init__.py
│   └── main.py           # FastAPI app and routes
├── examples/             # Usage examples
│   └── demo.py           # Library demo
├── pyproject.toml        # Package configuration
└── README.md             # This file
```

### Code Quality

- **Type hints**: Full type annotation coverage for better IDE support
- **Documentation**: Comprehensive module and function docstrings
- **Error handling**: Custom exception hierarchy for granular error handling
- **Logging**: Structured logging throughout with configurable levels
- **Testing**: Unit tests with pytest and mock objects
- **Standards**: Follows PEP 8 and modern Python best practices

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

```
{
    "id": "aalto-CUR-206690-3122470",
          └───────────┬────────────┘
              offering_id
    "code": "MS-A0108",
    "startDate": "2026-02-23",
    "endDate": "2026-04-17",
    ...,
    "courseUnitId": "aalto-OPINKOHD-1125839311-20210801",
                    └─────────────────┬────────────────┘
                           course_unit_id
    ...,
    "enrolmentStartDate": "2026-01-26",
    "enrolmentEndDate": "2026-03-02",
    ...
}
```


## Limitations

- **No location data**: Venue/room information is not available through the public API. Multiple events with identical times typically indicate different exam venues.
- **Recent offerings only**: The published realisations endpoint only returns upcoming or recently active offerings. Historical data requires different endpoints.
- **Read-only**: This wrapper only supports fetching data, not modifying it.
- **Rate limiting**: No built-in rate limiting - be respectful of the Sisu API


## Requirements

- Python 3.10+
- requests >= 2.32.5

### Development Requirements

- pytest >= 7.0


## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
