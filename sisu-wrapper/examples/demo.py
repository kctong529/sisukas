"""
Example usage of the Sisu Wrapper library

Demonstrates how to fetch course offering data, filter study groups
by type, iterate through study events, and use batch requests.
"""

import logging
from sisu_wrapper import (
    SisuClient, SisuService, SisuAPIError, SisuBatchError
)

# Configure logging at the start
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

print("=" * 70)
print("SINGLE COURSE OFFERING EXAMPLE")
print("=" * 70)

# Initialize client with custom timeout
client = SisuClient(timeout=15)
service = SisuService(client)

try:
    # Fetch complete course offering data
    offering = service.fetch_course_offering(
        course_unit_id="aalto-OPINKOHD-1125839311-20210801",
        offering_id="aalto-CUR-206690-3122470"
    )

    print(f"\nCourse: {offering.name}")
    print(f"Total study groups: {len(offering.study_groups)}")

    # Filter by group type
    lectures = offering.get_groups_by_type("Lecture")
    exercises = offering.get_groups_by_type("Exercise")

    # Get all events from a study group
    print("\nExercise Groups:")
    for group in exercises[:2]:  # Show first 2 groups
        print(f"\n  {group.type}: {group.name}")
        for event in group.sorted_events[:2]:  # Show first 2 events
            # Access as datetime objects
            start = event.start_datetime
            end = event.end_datetime

            # Or use the formatted representation
            print(f"    {event}")  # "24.02.2026 (Tue) 12:15 - 14:00"

            # Raw ISO strings are also available
            # print(f"    Raw: {event.start} to {event.end}")

except SisuAPIError as e:
    print(f"API Error: {e}")
finally:
    client.close()


print("\n" + "=" * 70)
print("BATCH CLIENT METHODS EXAMPLE")
print("=" * 70)

# Test batch methods at the client level
client2 = SisuClient(timeout=15)

try:
    # Define multiple course unit IDs to fetch
    course_unit_ids = [
        "aalto-OPINKOHD-1125839311-20210801",
        "otm-e737f80e-5bc4-4a34-9524-8243d7f9f14a",
    ]

    print("\nFetching multiple course units in batch...")
    try:
        batch_units = client2.fetch_course_units_batch(course_unit_ids)
        print(f"✓ Successfully fetched {len(batch_units)} course units")
        for unit_id, unit_data in batch_units.items():
            name = unit_data.get("name", {}).get("en", "Unnamed")
            print(f"  - {name}")
    except SisuBatchError as e:
        print(f"⚠ Batch error: {e}")
        print(f"  Failed requests: {e.failed_requests}")

except Exception as e:
    print(f"Error: {e}")
finally:
    client2.close()


print("\n" + "=" * 70)
print("BATCH SERVICE METHODS EXAMPLE")
print("=" * 70)

# Test batch methods at the service level
client3 = SisuClient(timeout=15)
service3 = SisuService(client3)

try:
    # Define multiple course offerings to fetch
    batch_requests = [
        ("aalto-OPINKOHD-1125839311-20210801", "aalto-CUR-206690-3122470"),
        ("otm-e737f80e-5bc4-4a34-9524-8243d7f9f14a", "aalto-CUR-206050-3121830"),
    ]

    print("\nFetching study groups for multiple offerings in batch...")
    try:
        batch_groups = service3.fetch_study_groups_batch(batch_requests)
        
        for (unit_id, offering_id), groups in batch_groups.items():
            if groups:
                print(f"\n  {unit_id[:30]}...")
                print(f"  {offering_id[:30]}...")
                print(f"  ✓ {len(groups)} study groups")
                for group in groups[:2]:  # Show first 2 groups
                    print(f"    - {group.type}: {group.name} ({len(group.study_events)} events)")
            else:
                print(f"\n  {unit_id}: No groups found")
    except SisuBatchError as e:
        print(f"⚠ Batch error: {e}")
        print(f"  Failed requests: {e.failed_requests}")

    print("\nFetching complete course offerings in batch...")
    try:
        batch_offerings = service3.fetch_course_offerings_batch(batch_requests)
        
        for (unit_id, offering_id), offering in batch_offerings.items():
            if offering:
                print(f"\n  Course: {offering.name}")
                print(f"  Unit: {unit_id[:30]}...")
                print(f"  Offering: {offering_id[:30]}...")
                print(f"  ✓ {len(offering.study_groups)} study groups")
            else:
                print(f"\n  {unit_id}/{offering_id}: Failed to fetch")
    except SisuBatchError as e:
        print(f"⚠ Batch error: {e}")
        print(f"  Failed requests: {e.failed_requests}")

except Exception as e:
    print(f"Error: {e}")
finally:
    client3.close()

print("\n" + "=" * 70)
print("DONE")
print("=" * 70)