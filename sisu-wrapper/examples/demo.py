"""
Example usage of the Sisu Wrapper library

Demonstrates how to fetch course offering data, filter study groups
by type, and iterate through study events.
"""

import logging
from sisu_wrapper import (
    SisuClient, SisuService, SisuAPIError
)

# Configure logging at the start
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Initialize client with custom timeout
client = SisuClient(timeout=15)
service = SisuService(client)

try:
    # Fetch complete course offering data
    offering = service.fetch_course_offering(
        course_unit_id="aalto-OPINKOHD-1125839311-20210801",
        offering_id="aalto-CUR-206690-3122470"
    )

    print(f"Course: {offering.name}")
    print(f"Total study groups: {len(offering.study_groups)}")

    # Filter by group type
    lectures = offering.get_groups_by_type("Lecture")
    exercises = offering.get_groups_by_type("Exercise")
    # Get all events from a study group

    for group in exercises:
        print(f"{group.type}: {group.name}")
        for event in group.sorted_events:
            # Access as datetime objects
            start = event.start_datetime
            end = event.end_datetime

            # Or use the formatted representation
            print(f"  {event}")  # "24.02.2026 (Tue) 12:15 - 14:00"

            # Raw ISO strings are also available
            # print(event.start)  # "2026-02-24T12:15:00+02:00"

except SisuAPIError as e:
    print(f"API Error: {e}")
finally:
    client.close()
