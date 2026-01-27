import argparse
import json
import logging
import os
from datetime import date
from typing import Dict, Any, List

from .client import SisuClient
from .aalto_api_client import AaltoCourseApiClient
from .historical import DateRange, read_course_unit_ids_from_courses_json, extract_historical_realisation_ids_for_course_unit

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def load_state(state_path: str) -> Dict[str, Any]:
    if not os.path.exists(state_path):
        return {}
    with open(state_path, "r", encoding="utf-8") as f:
        return json.load(f)

def save_state(state_path: str, state: Dict[str, Any]) -> None:
    tmp = state_path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    os.replace(tmp, state_path)

def append_jsonl(path: str, obj: Dict[str, Any]) -> None:
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")


def main() -> None:
    p = argparse.ArgumentParser("sisu-wrapper historical fetch (resumable)")
    p.add_argument("--courses-json", required=True, help="Path to (active) courses.json")
    p.add_argument("--out", default="historical_realisations.jsonl", help="JSONL output path")
    p.add_argument("--state", default="historical_state.json", help="Checkpoint state path")
    p.add_argument("--from-date", default="2022-09-01")
    p.add_argument("--to-date", default="2025-12-31")
    p.add_argument("--start-index", type=int, default=None, help="0-based index of courseUnitIds to start from")
    p.add_argument("--resume", action="store_true", help="Resume from --state if present")
    p.add_argument("--flush-every", type=int, default=1, help="Write checkpoint every N course units")
    p.add_argument("--limit-course-units", type=int, default=None, help="For testing only")
    args = p.parse_args()

    date_range = DateRange(
        start=date.fromisoformat(args.from_date),
        end=date.fromisoformat(args.to_date),
    )

    course_unit_ids: List[str] = read_course_unit_ids_from_courses_json(args.courses_json)
    if args.limit_course_units is not None:
        course_unit_ids = course_unit_ids[: args.limit_course_units]

    state = load_state(args.state) if args.resume else {}
    state_next = state.get("next_index") if isinstance(state.get("next_index"), int) else 0

    start_index = args.start_index if args.start_index is not None else state_next
    if start_index < 0:
        start_index = 0
    if start_index > len(course_unit_ids):
        start_index = len(course_unit_ids)

    logger.info("Total unique courseUnitIds: %d", len(course_unit_ids))
    logger.info("Starting at index %d", start_index)
    logger.info("Writing JSONL to %s", args.out)
    logger.info("Checkpoint file: %s", args.state)

    processed_units = 0
    written_records = 0

    with SisuClient() as sisu:
        course_api = AaltoCourseApiClient()
        current_index = start_index
        try:
            for i in range(start_index, len(course_unit_ids)):
                current_index = i
                cu_id = course_unit_ids[i]
                logger.info("[%d/%d] courseUnitId=%s", i + 1, len(course_unit_ids), cu_id)

                # Step 1: find historical CUR ids via Sisu
                try:
                    cur_ids = extract_historical_realisation_ids_for_course_unit(
                        sisu=sisu,
                        course_unit_id=cu_id,
                        date_range=date_range,
                    )
                except Exception as e:
                    logger.exception("Failed extracting CUR ids for %s: %s", cu_id, e)
                    cur_ids = []

                # Step 2: fetch each CUR payload via Course API, append to JSONL
                for cur_id in cur_ids:
                    try:
                        rec = course_api.fetch_course_unit_realisation(cur_id)
                    except Exception as e:
                        # 404s happen; keep going
                        logger.warning("Failed fetching CUR %s: %s", cur_id, e)
                        continue

                    # Ensure courseUnitId is present in output record
                    if isinstance(rec, dict) and "courseUnitId" not in rec:
                        rec["courseUnitId"] = cu_id
                    append_jsonl(args.out, rec)
                    written_records += 1

                processed_units = i + 1

                # checkpoint
                if processed_units % args.flush_every == 0:
                    save_state(args.state, {
                        "next_index": i + 1,  # next CU to process
                        "last_course_unit_id": cu_id,
                        "processed_units": processed_units,
                        "written_records": written_records,
                        "from_date": args.from_date,
                        "to_date": args.to_date,
                    })

        except KeyboardInterrupt:
            logger.warning("Interrupted. Saving checkpoint...")
            logger.warning("Interrupted. Saving checkpoint...")
            i = current_index
            save_state(args.state, {
                "next_index": i,  # resume from current CU next time
                "last_course_unit_id": course_unit_ids[i] if i < len(course_unit_ids) else None,
                "processed_units": processed_units,
                "written_records": written_records,
                "from_date": args.from_date,
                "to_date": args.to_date,
            })
            logger.warning("Checkpoint saved. Exiting cleanly.")
            return
        finally:
            course_api.close()

    save_state(args.state, {
        "next_index": len(course_unit_ids),
        "last_course_unit_id": course_unit_ids[-1] if course_unit_ids else None,
        "processed_units": processed_units,
        "written_records": written_records,
        "from_date": args.from_date,
        "to_date": args.to_date,
        "done": True,
    })

    print(f"Done. Wrote {written_records} JSONL records to {args.out}")


if __name__ == "__main__":
    main()
