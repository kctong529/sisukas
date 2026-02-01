#!/usr/bin/env python3
"""
Deduplicate historical.json against courses.json.

Removes entries from historical.json that exist in courses.json,
while detecting and logging conflicts when entries have different field values.
"""

import json
import sys
from pathlib import Path
from typing import Tuple, Dict, List, Any
import argparse


def parse_arguments() -> Tuple[str, str, str]:
    """
    Parse command line arguments.
    
    Returns:
        Tuple of (courses_file, historical_file, output_file)
    """
    parser = argparse.ArgumentParser(
        description="Deduplicate historical.json against courses.json",
        epilog="""
USAGE EXAMPLES:
  # Use default files (courses.json, historical.json)
  python3 dedup_historical_from_active.py

  # Specify custom input files
  python3 dedup_historical_from_active.py my_courses.json my_historical.json

  # Specify custom output file
  python3 dedup_historical_from_active.py -o my_output.json

  # Combine custom input and output
  python3 dedup_historical_from_active.py my_courses.json my_historical.json -o my_output.json

NOTE:
  - Must provide either 0 or 2 input files (not 1 or 3+)
  - Input files are never modified
  - Outputs: main file + optional _conflicts.json file
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "input_files",
        nargs="*",
        help="Input files: [courses.json historical.json] (optional, defaults to courses.json and historical.json)"
    )
    parser.add_argument(
        "-o",
        "--output",
        default="historical_deduped.json",
        help="Output filename (default: historical_deduped.json)"
    )
    
    args = parser.parse_args()
    
    # Validate that we have 0 or 2 positional arguments
    if len(args.input_files) not in (0, 2):
        parser.error("Must provide either 0 or 2 input files")
    
    if len(args.input_files) == 0:
        courses_file = "courses.json"
        historical_file = "historical.json"
    else:
        courses_file = args.input_files[0]
        historical_file = args.input_files[1]
    
    return courses_file, historical_file, args.output


def load_json_file(filepath: str) -> List[Dict[str, Any]]:
    """Load JSON file and return list of entries."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data if isinstance(data, list) else [data]
    except FileNotFoundError:
        print(f"Error: File '{filepath}' not found", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Failed to parse JSON from '{filepath}': {e}", file=sys.stderr)
        sys.exit(1)


def save_json_file(filepath: str, data: List[Dict[str, Any]]) -> None:
    """Save list of entries to JSON file."""
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def entries_equal(entry1: Dict[str, Any], entry2: Dict[str, Any]) -> bool:
    """Check if two entries are equal (all fields match)."""
    return entry1 == entry2


def find_differing_fields(entry1: Dict[str, Any], entry2: Dict[str, Any]) -> List[str]:
    """
    Find which fields differ between two entries.
    
    Returns:
        List of field names that differ
    """
    differing_fields = []
    all_keys = set(entry1.keys()) | set(entry2.keys())
    
    for key in sorted(all_keys):
        val1 = entry1.get(key)
        val2 = entry2.get(key)
        if val1 != val2:
            differing_fields.append(key)
    
    return differing_fields


def deduplicate(
    courses: List[Dict[str, Any]],
    historical: List[Dict[str, Any]]
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], int]:
    """
    Deduplicate historical against courses.
    
    Returns:
        Tuple of (output_entries, conflict_entries, conflict_count)
    """
    # Create id-indexed dictionaries for faster lookup
    courses_by_id = {entry["id"]: entry for entry in courses}
    
    output_entries = []
    conflict_entries = []
    conflict_count = 0
    
    for entry in historical:
        entry_id = entry["id"]
        
        if entry_id not in courses_by_id:
            # Entry only in historical, include it
            output_entries.append(entry)
        else:
            # Entry exists in both files
            courses_entry = courses_by_id[entry_id]
            
            if entries_equal(entry, courses_entry):
                # Entries are identical, skip
                pass
            else:
                # Entries differ, log as conflict
                differing_fields = find_differing_fields(entry, courses_entry)
                conflict_entries.append({
                    "id": entry_id,
                    "differing_fields": differing_fields,
                    "historical": entry,
                    "courses": courses_entry
                })
                conflict_count += 1
    
    return output_entries, conflict_entries, conflict_count


def validate_output(
    output: List[Dict[str, Any]],
    courses: List[Dict[str, Any]],
    historical: List[Dict[str, Any]]
) -> Tuple[bool, List[str]]:
    """
    Validate the deduplication results.
    
    Returns:
        Tuple of (all_valid, error_messages)
    """
    errors = []
    
    # Create id sets for comparison
    output_ids = {entry["id"] for entry in output}
    courses_ids = {entry["id"] for entry in courses}
    historical_ids = {entry["id"] for entry in historical}
    
    # Validation 1: No overlapping IDs between output and courses
    overlap = output_ids & courses_ids
    if overlap:
        errors.append(f"Error: {len(overlap)} overlapping IDs between output and courses.json")
    
    # Validation 2: All entries in output exist in original historical
    not_in_historical = output_ids - historical_ids
    if not_in_historical:
        errors.append(f"Error: {len(not_in_historical)} entries in output not found in original historical.json")
    
    # Validation 3: Union of output and courses equals union of historical and courses
    union_output_courses = output_ids | courses_ids
    union_historical_courses = historical_ids | courses_ids
    
    if union_output_courses != union_historical_courses:
        missing_in_output = union_historical_courses - union_output_courses
        extra_in_output = union_output_courses - union_historical_courses
        if missing_in_output:
            errors.append(f"Error: {len(missing_in_output)} IDs missing in output+courses union")
        if extra_in_output:
            errors.append(f"Error: {len(extra_in_output)} extra IDs in output+courses union")
    
    return len(errors) == 0, errors


def main():
    """Main function."""
    # Parse arguments
    courses_file, historical_file, output_file = parse_arguments()
    
    print(f"Loading courses from: {courses_file}")
    courses = load_json_file(courses_file)
    
    print(f"Loading historical from: {historical_file}")
    historical = load_json_file(historical_file)
    
    print(f"\nInitial statistics:")
    print(f"  Courses entries: {len(courses)}")
    print(f"  Historical entries: {len(historical)}")
    
    # Deduplicate
    print(f"\nProcessing deduplication...")
    output, conflicts, conflict_count = deduplicate(courses, historical)
    
    # Save output
    print(f"\nSaving deduplicated historical to: {output_file}")
    save_json_file(output_file, output)
    
    # Save conflicts if any
    if conflicts:
        conflicts_file = output_file.replace(".json", "_conflicts.json")
        print(f"Saving conflicts to: {conflicts_file}")
        save_json_file(conflicts_file, conflicts)
    
    # Validate
    print(f"\nValidating output...")
    is_valid, errors = validate_output(output, courses, historical)
    
    # Print summary
    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"Original historical entries:    {len(historical)}")
    print(f"Courses entries:                {len(courses)}")
    print(f"Output entries:                 {len(output)}")
    print(f"Conflict entries (not in output): {conflict_count}")
    print(f"\nEntries removed from historical: {len(historical) - len(output)}")
    print(f"  (entries that exist in courses.json)")
    
    if conflicts:
        print(f"\nConflict entries found: {conflict_count}")
        conflicts_file = output_file.replace(".json", "_conflicts.json")
        print(f"  Saved to: {conflicts_file}")
    else:
        print(f"\nNo conflicting entries found.")
    
    print(f"\nValidation results:")
    if is_valid:
        print(f"  ✓ All validations passed")
    else:
        print(f"  ✗ Validation failed:")
        for error in errors:
            print(f"    - {error}")
        sys.exit(1)
    
    print(f"{'='*60}")


if __name__ == "__main__":
    main()