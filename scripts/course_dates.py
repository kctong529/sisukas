import re
from datetime import datetime, date

_DATE_ONLY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_UPSTREAM_DATETIME = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}\.\d{2}\.\d{2}$"
)


def normalize_course_date(value, *, nullable=False):
    """Normalize supported API dates to YYYY-MM-DD."""

    if value is None:
        if nullable:
            return None
        raise ValueError("Required course date is missing")

    if not isinstance(value, str):
        raise ValueError(f"Invalid course date: {value!r}")

    if _DATE_ONLY.fullmatch(value):
        return date.fromisoformat(value).isoformat()

    if _UPSTREAM_DATETIME.fullmatch(value):
        parsed = datetime.strptime(value, "%Y-%m-%dT%H.%M.%S")
        return parsed.date().isoformat()

    raise ValueError(f"Unsupported course date format: {value!r}")
