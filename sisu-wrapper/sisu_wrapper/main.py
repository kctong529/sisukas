"""
A lightweight Python wrapper for the Aalto University Sisu API

This module provides a simple interface for fetching structured JSON data
from Sisu's public Kori API endpoints. It includes helper methods for
retrieving course units, course realisations, and study events, with
robust error handling and connection pooling.

Limitations:
    - Location/venue information is not available through the public API
    - Only published, upcoming/recent course realisations are included
    - Historical realisations require different endpoints
"""

import logging
from client import SisuAPI, SisuAPIError
from orchestrator import fetch_study_groups

logger = logging.getLogger(__name__)


def main():
    """Demonstration of fetching course data and printing study events."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s: %(message)s"
    )

    # Example: Calculus 1 Lecture from Aalto Sisu Open API
    course_offering_id = "aalto-CUR-206690-3122470"
    course_unit_id = "aalto-OPINKOHD-1125839311-20210801"

    try:
        study_groups = fetch_study_groups(course_unit_id, course_offering_id)

        for study_group in study_groups:
            print(f"{study_group.type}: {study_group.name}")
            for event in study_group.sorted_events:
                print(f"  {event}")
            print()

    except SisuAPIError as e:
        logger.error("API error: %s", e)
    except Exception as e:
        logger.exception("Unexpected error: %s", e)
    finally:
        SisuAPI.close_session()
        logging.info("Session closed.")


if __name__ == "__main__":
    main()
