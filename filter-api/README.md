# Filter API

A FastAPI-based microservice for managing and sharing course filter configurations. This API allows users to save complex filter queries with multiple groups and rules, generating shareable hash identifiers for easy retrieval.

## Features

- **Hierarchical Filter Structure**: Support for must rules (universal constraints) and alternative groups (OR logic)
- **Hash-based Storage**: Save filter configurations with auto-generated short hash IDs
- **Shareable URLs**: Retrieve filters via hash identifiers for easy sharing
- **RESTful API Design**: Automatic OpenAPI documentation with Swagger UI
- **Type-safe Models**: Pydantic-based validation for all filter components
- **Fast, Async Handling**: Built on FastAPI for high-performance request processing

## Filter Structure

The API uses a two-tier filter architecture:

### FilterRule (Atomic Condition)
Single filter condition with:
- `field`: Course attribute to filter (e.g., "code", "major", "period")
- `relation`: Comparison method (e.g., "contains", "is", "overlaps")
- `value`: Value to compare against

### FilterGroup (AND Logic)
Collection of rules that must all match:
- `rules`: List of FilterRule objects
- `is_must`: Boolean flag indicating universal constraint vs. alternative pattern

### FilterQuery (Complete Specification)
Complete filter with:
- `groups`: List of FilterGroup objects
- Must groups (`is_must=True`) apply universally with AND logic
- Alternative groups (`is_must=False`) apply with OR logic (any match qualifies)

**Example**: "Show courses in Period II that are open for enrollment (must), and are either CS courses, or DSD major courses, or taught by Milo"

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

## Installation

1. Navigate to the filter-api directory:
```sh
cd filter-api
```

2. Create a virtual environment:
```sh
python -m venv .venv
```

3. Activate the virtual environment:

**On macOS/Linux:**
```sh
source .venv/bin/activate
```

**On Windows:**
```sh
.venv\Scripts\activate
```

4. Verify Python is using the virtual environment:
```sh
which python  # Should show path to .venv/bin/python
```

5. Upgrade pip:
```sh
python -m pip install --upgrade pip
```

6. Install dependencies:
```sh
pip install -r requirements.txt
```

## Running the API

### Development Mode
Start the development server with auto-reload:
```sh
fastapi dev main.py
```

The API will be available at `http://localhost:8000`

### Production Mode
Run the production server:
```sh
fastapi run main.py
```

## API Documentation

Once the server is running, you can access:
- **Interactive API docs (Swagger UI):** http://localhost:8000/docs
- **Alternative API docs (ReDoc):** http://localhost:8000/redoc
- **OpenAPI schema:** http://localhost:8000/openapi.json

## API Endpoints

### `GET /`
API information and health check endpoint.

**Response:**
```json
{
  "service": "Sisukas Filters API",
  "version": "0.0.2",
  "description": "Save and retrieve filter configurations for course selection",
  "endpoints": {
    "save": "/api/filters/save/",
    "load": "/api/filters/{hash}/",
    "docs": "/docs"
  },
  "stats": {
    "stored_filters": 0
  }
}
```

### `POST /api/filters/save/`
Save a filter configuration and receive a hash identifier.

**Request Body:**
```json
{
  "groups": [
    {
      "rules": [
        {
          "field": "period",
          "relation": "overlaps",
          "value": "2025-26 Period II"
        },
        {
          "field": "enrollment",
          "relation": "is_open",
          "value": "today"
        }
      ],
      "is_must": true
    },
    {
      "rules": [
        {
          "field": "major",
          "relation": "is",
          "value": "DSD24"
        }
      ],
      "is_must": false
    },
    {
      "rules": [
        {
          "field": "teacher",
          "relation": "contains",
          "value": "Milo"
        }
      ],
      "is_must": false
    }
  ]
}
```

**Response:**
```json
{
  "hash": "a3f5d8e9c2b14f67"
}
```

### `GET /api/filters/{filter_hash}/`
Retrieve a previously saved filter configuration by its hash.

**Response:**
```json
{
  "groups": [
    {
      "rules": [
        {
          "field": "period",
          "relation": "overlaps",
          "value": "2025-26 Period II"
        }
      ],
      "is_must": true
    }
  ]
}
```

**Error Response (404):**
```json
{
  "detail": "Filter not found"
}
```

## Usage Examples

### Save a Filter
```bash
curl -X POST http://localhost:8000/api/filters/save/ \
  -H "Content-Type: application/json" \
  -d '{
    "groups": [
      {
        "rules": [
          {"field": "price", "relation": "lessThan", "value": 500},
          {"field": "inStock", "relation": "is", "value": true}
        ],
        "is_must": true
      },
      {
        "rules": [
          {"field": "category", "relation": "is", "value": "electronics"}
        ],
        "is_must": false
      }
    ]
  }'
```

### Retrieve a Filter
```bash
curl http://localhost:8000/api/filters/a3f5d8e9c2b14f67/
```

## Project Structure
```
filter-api/
├── main.py              # FastAPI application, models, and routes
├── requirements.txt     # Python dependencies
├── .venv/               # Virtual environment (not in git)
└── README.md            # This file
```

## Development

### Adding Dependencies
After installing new packages:
```sh
pip freeze > requirements.txt
```

### Deactivating Virtual Environment
When done working:
```sh
deactivate
```

### Testing the API
Use the interactive docs at `/docs` to test endpoints, or use curl/httpie for command-line testing.

## Storage

**Current (Development):** In-memory dictionary storage (resets on restart)

**Production:** Each filter configuration is stored as a JSON file in a Google Cloud Storage bucket:
- File naming: `{hash}.json` (e.g., `a3f5d8e9c2b14f67.json`)
- Bucket structure: Flat namespace with hash-based file names
- Benefits: Simple, scalable, serverless-friendly, no database maintenance

## Version History

- **0.0.2** (Current): Complete filter query system with hierarchical structure
- **0.0.1**: Initial single filter rule endpoint (deprecated)

## License

This project is licensed under the MIT License. See the [LICENSE](../LICENSE) file for details.