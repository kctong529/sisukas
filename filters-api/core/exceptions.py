"""
core/exceptions.py
==================

Custom exception handlers for the Sisukas Filters API.

This module provides FastAPI-compatible handlers for consistent JSON responses
and structured logging of errors. It includes:

- HTTP exceptions (HTTPException)
- Pydantic/FastAPI validation errors (RequestValidationError)
- Catch-all unhandled exceptions

These handlers are intended to be registered with FastAPI using
app.add_exception_handler().


Handlers
--------
- http_exception_handler: Returns JSON response for HTTPException
- validation_exception_handler: Returns JSON response for validation errors
- unhandled_exception_handler: Returns JSON response for unexpected errors
"""

import logging
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

logger = logging.getLogger("uvicorn.error")


async def http_exception_handler(
    request: Request,
    exc: HTTPException
):
    """Handles HTTPExceptions with consistent JSON output"""
    logger.warning(
        "%s error at %s: %s",
        exc.status_code,
        request.url.path,
        exc.detail
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError
):
    """Handles validation errors from Pydantic/FastAPI"""
    logger.warning(
        "422 validation error at %s: %s",
        request.url.path,
        exc.errors()
    )
    first_error = (
        exc.errors()[0]["msg"]
        if exc.errors()
        else "Invalid request data"
    )
    return JSONResponse(
        status_code=422,
        content={"detail": first_error},
    )


async def unhandled_exception_handler(
    request: Request,
    exc: Exception
):
    """Catch-all handler for unexpected errors"""
    logger.exception(
        "Unhandled error at %s: %s",
        request.url.path,
        exc
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
