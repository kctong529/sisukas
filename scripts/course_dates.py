"""Date normalization for course catalog ingestion."""

from datetime import date, datetime
import re


_UPSTREAM_DATETIME = re.compile(
    r"^(\d{4}-\d{2}-\d{2})T(\d{2})\.(\d{2})\.(\d{2})$"
)


def normalize_enrolment_date(value):
    """Normalize supported enrolment dates to YYYY-MM-DD."""
    if value is None:
        return None

    if not isinstance(value, str):
        raise ValueError(f"Invalid enrolment date: {value!r}")

    try:
        # Existing date-only representation.
        return date.fromisoformat(value).isoformat() if re.fullmatch(
            r"\d{4}-\d{2}-\d{2}", value
        ) else _normalize_upstream_datetime(value)
    except ValueError as exc:
        raise ValueError(
            f"Invalid enrolment date: {value!r}"
        ) from exc


def _normalize_upstream_datetime(value):
    match = _UPSTREAM_DATETIME.fullmatch(value)

    if not match:
        raise ValueError(f"Unsupported enrolment date format: {value!r}")

    day, hour, minute, second = match.groups()

    datetime.strptime(
        f"{day}T{hour}:{minute}:{second}",
        "%Y-%m-%dT%H:%M:%S",
    )

    return day
