import argparse
import json
import logging
from datetime import date

from .client import SisuClient
from .aalto_api_client import AaltoCourseApiClient
from .historical import DateRange, fetch_historical_realisations_for_courses_json

logging.basicConfig(level=logging.INFO)


def main() -> None:
    p = argparse.ArgumentParser("sisu-wrapper historical fetch")
    p.add_argument("--courses-json", required=True, help="Path to courses.json")
    p.add_argument("--out", default="historical_realisations_sample.json")
    p.add_argument("--from-date", default="2022-09-01")
    p.add_argument("--to-date", default="2024-12-31")
    p.add_argument("--limit-course-units", type=int, default=None)
    p.add_argument("--limit-realisations-per-unit", type=int, default=None)
    args = p.parse_args()

    date_range = DateRange(
        start=date.fromisoformat(args.from_date),
        end=date.fromisoformat(args.to_date),
    )

    with SisuClient() as sisu:
        course_api = AaltoCourseApiClient()
        result = fetch_historical_realisations_for_courses_json(
            courses_json_path=args.courses_json,
            sisu=sisu,
            course_api=course_api,
            date_range=date_range,
            limit_course_units=args.limit_course_units,
            limit_realisations_per_unit=args.limit_realisations_per_unit,
        )
        course_api.close()

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
