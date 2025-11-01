# Sisukas Filters API

A FastAPI-based microservice for managing and sharing course filter configurations in [Sisukas](https://sisukas.eu/), a lightweight alternative to the official SISU system. This API allows users to save complex filter queries with multiple groups and rules, generating shareable hash identifiers for easy retrieval and distribution.

> [!TIP]
> This API is a backend service component of Sisukas. For the main application and full project documentation, visit the [Sisukas repository](https://github.com/kctong529/sisukas).


## Features

- **Hierarchical Filter Structure**: Support for must rules (universal constraints) and alternative groups (OR logic)
- **Hash-based Storage**: Save filter configurations with auto-generated short hash IDs
- **Persistent Cloud Storage**: JSON file-based storage in Google Cloud Storage (GCS)
- **Idempotent Operations**: Identical filter configurations reuse existing hash IDs
- **Shareable URLs**: Retrieve filters via hash identifiers for easy sharing
- **RESTful API Design**: OpenAPI documentation with Swagger UI
- **Type-safe Models**: Pydantic-based validation for all filter components
- **Fast, Async Handling**: Built on FastAPI for high-performance request processing
- **CORS Support**: Configurable cross-origin resource sharing


## Integration with Sisukas

This API enables shareable filter configurations in the Sisukas frontend:

1. Users create filter configurations in the Sisukas UI
2. Frontend sends configurations to `POST /api/filters`
3. API returns a short hash ID
4. Hash ID is embedded in shareable URLs (e.g., `sisukas.eu?filter=a3f5d8e9c2b14f67`)
5. When users visit the shared URL, frontend fetches the filter via `GET /api/filters/{hash_id}`
6. Filter configuration is applied to the course browser

For more details on the overall architecture, see the [Sisukas documentation](https://docs.sisukas.eu/).


## Filter Structure

The API uses a two-tier filter architecture:

### FilterRule (Atomic Condition)
Single filter condition with:
- `field`: Course attribute to filter (e.g. "code", "major", "period")
- `relation`: Comparison method (e.g. "contains", "is", "overlaps")
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


## Getting Started

### Prerequisites

- Python 3.12 or higher
- [uv](https://docs.astral.sh/uv/) - Fast Python package manager
- Node.js v18+ (only if running the full Sisukas stack)

### Installation & Setup

Option 1: From Parent Repository (Recommended)

```sh
# Clone and set up the full Sisukas project
git clone https://github.com/kctong529/sisukas.git
cd sisukas
make setup  # Sets up all components including filters-api
```

Option 2: Standalone Setup

```sh
# Navigate to filters-api directory
cd filters-api

# Create virtual environment and install dependencies
uv venv --python 3.12 .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uv pip sync requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings (see Configuration section below)
```

### Running the API

Start the development server:

```sh
# From filters-api directory
uv run fastapi dev main.py
```

The API will be available at `http://localhost:8000`

> [!NOTE]
> If running the full Sisukas stack, use port 8000 for filters-api and 8001 for sisu-wrapper to avoid conflicts.


## Configuration

The API uses environment variables for configuration. For local development, copy and edit the example file:

```sh
cp .env.example .env
```

### Environment Variables

* **`SISUKAS_ENV`**: Environment mode (`test` for local development, `production` for deployment)

* **`GCS_BUCKET_NAME`**: Google Cloud Storage bucket name for filter storage
  - Development: `sisukas-filters-api-test`
  - Production: `sisukas-filters-api-prod`

* **`CORS_ORIGINS`**: Comma-separated list of allowed CORS origins
  - Development: `http://localhost:5173,http://127.0.0.1:5173`
  - Production: `https://sisukas.fly.dev,https://sisukas.eu`

**Example `.env` for local development:**
```sh
SISUKAS_ENV=test
GCS_BUCKET_NAME=sisukas-filters-api-test
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

> [!IMPORTANT]
> Production environment variables are managed through GitHub Actions and Google Cloud Run. Only modify these for local development or custom deployments.


## API Documentation

The Filters API provides four main endpoints:

- **`GET /`** - API metadata and health check
- **`POST /api/filters`** - Save a filter configuration, returns hash ID
- **`GET /api/filters/{hash_id}`** - Retrieve a saved filter by hash ID
- **`DELETE /api/filters/{hash_id}`** - Delete a saved filter by hash ID

**Interactive Documentation:**
- Local: http://localhost:8000/docs (Swagger UI) | http://localhost:8000/redoc (ReDoc)
- Production: https://filters-api.sisukas.eu/docs

### Quick Examples

```bash
# Save a filter
curl -X POST http://localhost:8000/api/filters \
  -H "Content-Type: application/json" \
  -d '{"groups":[{"rules":[{"field":"period","relation":"is","value":"2025-26 Period II"}],"is_must":true}]}'

# Retrieve a filter (replace with your hash_id)
curl http://localhost:8000/api/filters/a3f5d8e9c2b14f67

# Delete a filter
curl -X DELETE http://localhost:8000/api/filters/a3f5d8e9c2b14f67
```

For complete examples and interactive testing, visit the Swagger UI documentation.


## Project Structure
```
sisukas/                      # Parent repository
├── Makefile                  # Build automation (setup, clean, etc.)
└── filters-api/              # This component
    ├── README.md
    ├── main.py               # FastAPI application entrypoint
    ├── requirements.in       # Direct dependencies
    ├── requirements.txt      # Compiled/pinned dependencies
    ├── .env.example          # Example environment configuration
    ├── .env                  # Environment configuration (not in repo)
    ├── core/                 # Core configuration and exception handling
    │   ├── __init__.py
    │   ├── config.py         # Environment and storage configuration
    │   └── exceptions.py     # Custom FastAPI exception handlers
    ├── models/               # Pydantic models for filters and responses
    │   ├── __init__.py
    │   ├── filter_models.py  # Filter-related models and hash validation
    │   └── response_models.py # API response models
    ├── routers/              # API route definitions
    │   ├── __init__.py
    │   ├── filters.py        # /api/filters endpoints
    │   └── root.py           # / root endpoint
    ├── storage/              # Storage utilities
    │   ├── __init__.py
    │   └── file_storage.py   # GCS storage utilities
    └── utils/                # Utility modules
        ├── __init__.py
        └── responses.py      # Standardized endpoint responses
```


## Storage

Filters are stored as JSON files in **Google Cloud Storage (GCS)**:

* **File naming**: `{hash_id}.json`
* **Hash generation**: SHA-256 based, starting at 16 characters
* **Collision handling**: Automatic hash extension if collision detected
* **Idempotent saves**: Identical filters reuse existing hash IDs
* **Persistence**: Filters persist across API restarts
* **Metadata**: Each blob stores the full SHA-256 hash for collision detection


## Development

### Running Tests

```sh
# Using pytest (if tests exist)
pytest

# Using uv
uv run pytest
```

### Dependency Management

The project uses `uv` for dependency management:

```sh
# Compile requirements.in to requirements.txt (from sisukas root)
make compile-requirements

# Or manually for filters-api only
cd filters-api && uv pip compile requirements.in --universal --output-file requirements.txt

# Update virtual environment after changes
uv pip sync requirements.txt
```

> [!NOTE]
> Remember to commit the updated `requirements.txt` after modifying dependencies.

### Clean Environment

To remove virtual environments and start fresh:

```sh
# From sisukas root directory
make clean

# Or manually
rm -rf filters-api/.venv
```


## Deployment

### Automated Deployment (Official)

The Filters API is automatically deployed to Google Cloud Run via GitHub Actions when changes are pushed to the main branch. The production API is available at https://filters-api.sisukas.eu.

**Deployment Details:**
- **Platform**: Google Cloud Run with automatic scaling
- **Environment**: Production configuration with GCS backend
- **Monitoring**: Built-in Cloud Run logging and metrics

### Custom Deployment

To deploy your own instance:

#### Prerequisites
- Google Cloud Platform account with billing enabled
- Google Cloud Storage bucket for filter storage
- Domain name (optional, for custom URL)

#### Steps

1. **Set up GCP resources** (Cloud Run service and GCS bucket)

2. **Configure environment variables** in your deployment platform:
   ```sh
   SISUKAS_ENV=production
   GCS_BUCKET_NAME=your-filters-bucket
   CORS_ORIGINS=https://your-domain.com
   ```

3. **Set up CI/CD** (optional):
   - Add GCP service account credentials as repository secret
   - Configure GitHub Actions workflow
   - See `.github/workflows/` in the parent repository for reference

**Deployment Architecture:**
- Runtime: Python 3.12 on Cloud Run
- Scaling: Automatic (0 to N instances based on traffic)
- Storage: Google Cloud Storage for persistent filter data

For detailed deployment instructions, refer to the [Sisukas deployment documentation](https://docs.sisukas.eu/).


## Troubleshooting

### Port already in use
```sh
# Error: Address already in use
# Solution: Use a different port
uv run fastapi dev main.py --port 8001
```

### GCS authentication errors
```sh
# Error: Could not automatically determine credentials
# Solution: Set up Application Default Credentials
gcloud auth application-default login
```

### CORS issues
If your frontend can't connect:
1. Check `CORS_ORIGINS` in `.env` includes your frontend URL
2. Restart the API after changing `.env`
3. Verify the URL format (include protocol: `http://` or `https://`)

### Hash collision (rare)
If you see "Hash collision detected" in logs:
- This is handled automatically by extending the hash
- No action needed - the system will retry with a longer hash


## Security & Limitations

### Authentication
Currently, the API does **NOT** require authentication. This means:
- Anyone can save and retrieve filters
- Filters are public if the hash is known
- Anyone can delete filters if they have the hash ID

**For production use**: Consider implementing authentication for DELETE operations or storing filters with user associations.

### Rate Limiting
- No built-in rate limiting (relies on Cloud Run quotas in production)
- Local development: unlimited requests
- Production: Subject to GCP quotas and billing limits

### Storage Limits
- **Hash length**: Starts at 16 characters, auto-extends on collision
- **Filter size**: No hard limit, but keep under 1MB for optimal performance
- **Storage cost**: GCS Standard Storage pricing applies (~$0.02/GB/month)


## Version History

- **0.3.2**: Current version with GCS storage and improved error handling
- **0.3.0**: Switched to GCS-based storage
- **0.2.0**: Standardized responses and robust error handling
- **0.1.0**: Initial file-based storage implementation
- **0.0.5**: Added error handling improvements
- **0.0.4**: Initial in-memory storage implementation
- **0.0.2**: Complete filter query system with hierarchical structure
- **0.0.1**: Initial single filter rule endpoint (deprecated)

## License

This project is licensed under the MIT License. See the [LICENSE](../LICENSE) file for details.
