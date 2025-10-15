# Filter API

A FastAPI-based microservice for managing and sharing course filter configurations. This API allows users to save filter settings and generate shareable URLs.

## Features

- Save filter configurations with generated hash IDs
- Retrieve filters via short hash identifiers
- RESTful API design with automatic documentation
- Fast, async request handling

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
```bash
fastapi dev main.py
```

The API will be available at `http://localhost:8000`

### Production Mode

Run the production server:
```bash
fastapi run main.py
```

## API Documentation

Once the server is running, you can access:

- **Interactive API docs (Swagger UI):** http://localhost:8000/docs
- **Alternative API docs (ReDoc):** http://localhost:8000/redoc
- **OpenAPI schema:** http://localhost:8000/openapi.json

## API Endpoints

### `GET /`

Health check endpoint.

**Response:**
```json
{
  "message": "Hello World"
}
```

## Project Structure
```
filter-api/
├── main.py              # FastAPI application and routes
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

## Deployment

This API is deployed on Google Cloud Run. See the main repository README for deployment instructions.

## License

This project is licensed under the MIT License. See the [LICENSE](../LICENSE) file for details.
