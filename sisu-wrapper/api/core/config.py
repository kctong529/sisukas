import os


# --- FastAPI app configuration ---
CORS_ORIGINS: list[str] = [
    origin.strip() for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
        ",https://sisukas.fly.dev,https://sisukas.eu"
        ",https://sisukas-test.fly.dev,https://fuzzy-test-969370446235.europe-north1.run.app"
        ",https://fuzzy-test.sisukas.eu"
    ).split(",")
]

API_VERSION = "0.0.3"
API_TITLE = "Sisu Wrapper API"
API_CONTACT = {
    "name": "API Support",
    "email": "kichun.tong@aalto.fi"
}
