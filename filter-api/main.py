"""
main.py - Sisukas Filters API

This FastAPI application provides endpoints to define and manage filter rules
for course selection. A filter rule allows clients to specify conditions
for courses, such as filtering by course code, major, language, or start date.

Endpoints:
    POST /api/filter
        Accepts a single filter rule in the request body and returns it
        as a JSON object. This is a demo endpoint to create a single
        filter rule for testing purposes.

    GET /
        Health check endpoint that returns a simple "Hello World" message.

Models:
    FilterRule
        Represents a single filter rule, including:
        - boolean: Optional logical operator ("AND" or "OR")
        - field: The course field to filter (e.g., "code", "major")
        - relation: Comparison relation (e.g., "Contains", "Is", "After")
        - value: Value to compare the field against

Usage:
    Run the application with FastAPI:
        fastapi dev main.py

    Example POST request body:
        {
            "boolean": "AND",
            "field": "major",
            "relation": "is",
            "value": "DSD24"
        }

    The response will return the same filter rule in JSON format.
"""

from typing import Optional
from fastapi import FastAPI
from pydantic import BaseModel, Field


app = FastAPI(
    title="Sisukas Filters API",
    version="0.0.1",
    contact={
        "name": "API Support",
        "email": "kichun.tong@aalto.fi",
    }
)


# Pydantic model
class FilterRule(BaseModel):
    """Represents a single filter rule for course filtering."""

    boolean: Optional[str] = Field(
        None,
        max_length=10,
        examples=["AND", "OR"]
    )
    field: str = Field(
        ...,
        min_length=1,
        max_length=100,
        examples=["code", "name", "language", "level", "startDate",
                  "credits", "period", "major"]
    )
    relation: str = Field(
        ...,
        min_length=1,
        max_length=50,
        examples=["Contains", "Is", "Before", "After", "Is In"]
    )
    value: str = Field(
        ...,
        min_length=1,
        max_length=500,
        examples=["CS", "2025-10-10", "en", "basic-studies", "DSD24"]
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "boolean": None,
                "field": "code",
                "relation": "contains",
                "value": "CS"
            }
        }
    }


@app.post(
    "/api/filter",
)
async def create_filter_rule(request: FilterRule):
    """
    Create a new filter rule for course selection.
    """
    return request.model_dump()


@app.get("/")
async def root():
    """
    Health check endpoint.
    """
    return {"message": "Hello World"}
