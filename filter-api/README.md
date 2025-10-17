# Filter API

A FastAPI-based microservice for managing and sharing course filter configurations. This API allows users to save complex filter queries with multiple groups and rules, generating shareable hash identifiers for easy retrieval.

## Features

- **Hierarchical Filter Structure**: Support for must rules (universal constraints) and alternative groups (OR logic)
- **Hash-based Storage**: Save filter configurations with auto-generated short hash IDs
- **Persistent File Storage**: JSON file-based storage with environment-specific directories
- **Environment Configuration**: Separate prod/test environments with .env file support
- **Shareable URLs**: Retrieve filters via hash identifiers for easy sharing
- **RESTful API Design**: Automatic OpenAPI documentation with Swagger UI
- **Type-safe Models**: Pydantic-based validation for all filter components
- **Fast, Async Handling**: Built on FastAPI for high-performance request processing
- **CORS Support**: Configurable cross-origin resource sharing

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

7. Create a `.env` file for configuration:
```sh
# .env
SISUKAS_ENV=test  # or "prod"
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
SISUKAS_ENV=prod fastapi run main.py
```

## Configuration

The API uses environment variables for configuration, loaded from a `.env` file:
- `SISUKAS_ENV`: Environment mode ("test" or "prod", defaults to "test")

Storage directories are automatically created based on the environment:
- Test mode: `storage/filters_test/`
- Production mode: `storage/filters_prod/`

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
  "version": "0.1.0",
  "environment": "test",
  "description": "Save and retrieve filter configurations for course selection",
  "endpoints": {
    "save": "/api/filter",
    "load": "/api/filter/{hash_id}",
    "docs": "/docs"
  },
  "storage_dir": "/path/to/storage/filters_test",
  "stats": {
    "stored_filters": 42
  }
}
```

### `POST /api/filter`
Save a filter configuration and receive a hash identifier.

**Request Body:**
```json
{
  "groups": [
    {
      "rules": [
        {
          "field": "period",
          "relation": "is",
          "value": "2025-26 Period II"
        },
        {
          "field": "enrollment",
          "relation": "overlaps",
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
  "hash_id": "a3f5d8e9c2b14f67"
}
```

### `GET /api/filter/{hash_id}`
Retrieve a previously saved filter configuration by its hash.

**Response:**
```json
{
  "groups": [
    {
      "rules": [
        {
          "field": "period",
          "relation": "is",
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
curl -X POST http://localhost:8000/api/filter \
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
curl http://localhost:8000/api/filter/a3f5d8e9c2b14f67/
```

## Project Structure
```
filter-api/
├── main.py              # FastAPI application, models, and routes
├── config.py            # Environment and storage configuration
├── file_storage.py      # File-based storage utilities
├── requirements.txt     # Python dependencies
├── .env                 # Environment variables (not in git)
├── .gitignore           # Git ignore patterns
├── storage/             # Filter storage directory (not in git)
│   ├── filters_test/    # Test environment filters
│   └── filters_prod/    # Production environment filters
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

Filters are stored as JSON files in environment-specific directories:

- **File naming**: `{hash_id}.json` (e.g., `a3f5d8e9c2b14f67.json`)
- **Hash generation**: SHA-256 based, starting at 16 characters
- **Collision handling**: Automatic hash extension if collision detected
- **Idempotent saves**: Identical filters reuse existing hash IDs
- **Persistence**: Filters persist across API restarts

The storage system automatically:
- Creates storage directories if they don't exist
- Handles hash collisions by extending the hash length
- Reuses existing hashes for identical filter configurations

## Version History

- **0.1.0** (Current): File-based storage with environment configuration
- **0.0.5**: Added error handling improvements
- **0.0.4**: Initial in-memory storage implementation
- **0.0.2**: Complete filter query system with hierarchical structure
- **0.0.1**: Initial single filter rule endpoint (deprecated)

## License

This project is licensed under the MIT License. See the [LICENSE](../LICENSE) file for details.