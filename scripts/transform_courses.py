import json
import sys
import os

def transform_course(c):
    """Return the reduced course object with only required fields."""

    summary = c.get("summary", {})

    return {
        "id": c.get("id"),
        "code": c.get("code"),
        "startDate": c.get("startDate"),
        "endDate": c.get("endDate"),
        "type": c.get("type"),
        "name": c.get("name", {}),

        "summary": {
            "prerequisites": summary.get("prerequisites", {}),
            "level": summary.get("level", {}),
        },

        "organizationName": c.get("organizationName", {}),
        "credits": c.get("credits", {}),
        "courseUnitId": c.get("courseUnitId"),
        "languageOfInstructionCodes": c.get("languageOfInstructionCodes"),
        "teachers": c.get("teachers", []),
        "enrolmentStartDate": c.get("enrolmentStartDate"),
        "enrolmentEndDate": c.get("enrolmentEndDate"),
    }


def main():
    if len(sys.argv) != 3:
        print("Usage: python transform_courses.py <input.json> <output.json>")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    # Load raw data
    with open(input_path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    if not isinstance(raw_data, list):
        print("Error: expected top-level array of course objects.")
        sys.exit(1)

    # Transform each course
    transformed = [transform_course(c) for c in raw_data]

    # Write to output
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(transformed, f, ensure_ascii=False, indent=2)

    # Stats
    original_size = os.path.getsize(input_path)
    new_size = os.path.getsize(output_path)

    print("Transformation completed.")
    print(f" Courses processed: {len(raw_data)}")
    print(f" Original size: {original_size/1024:.1f} KB")
    print(f" Reduced size:  {new_size/1024:.1f} KB")
    print(f" Reduction:     {100*(1-new_size/original_size):.1f}%")

if __name__ == "__main__":
    main()