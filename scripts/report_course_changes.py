import json
import os
from datetime import datetime

def get_important_fields(course):
    """Extract important fields from a course for comparison"""
    return {
        'code': course.get('code', ''),
        'name_en': course.get('name', {}).get('en', ''),
        'credits_min': course.get('credits', {}).get('min'),
        'start_date': course.get('startDate'),
        'end_date': course.get('endDate'),
        'enrolment_start': course.get('enrolmentStartDate'),
        'enrolment_end': course.get('enrolmentEndDate')
    }

def diff_important_fields(old, new):
    """Compare important fields and return human-readable changes"""
    changes = []
    for key, old_val in old.items():
        new_val = new.get(key)
        if old_val != new_val:
            field_name = key.replace('_', ' ').title()
            if (field_name == "Name En"):
                field_name = "Name"
            changes.append((field_name, old_val, new_val))
    return changes

def truncate(text, max_length=60):
    """Truncate text to a maximum length, adding '...' if it's too long."""
    if not text:
        return ''
    return text if len(text) <= max_length else text[:max_length-3] + '...'

def compare_courses(old_path, new_path):
    with open(old_path, "r", encoding="utf-8") as f:
        old_courses = json.load(f)
    with open(new_path, "r", encoding="utf-8") as f:
        new_courses = json.load(f)

    old_by_id = {c["id"]: c for c in old_courses}
    new_by_id = {c["id"]: c for c in new_courses}

    added = [c for cid, c in new_by_id.items() if cid not in old_by_id]
    removed = [c for cid, c in old_by_id.items() if cid not in new_by_id]

    updated = []
    for cid in new_by_id:
        if cid in old_by_id:
            old_fields = get_important_fields(old_by_id[cid])
            new_fields = get_important_fields(new_by_id[cid])
            if old_fields != new_fields:
                updated.append((old_by_id[cid], new_by_id[cid]))

    if not (added or removed or updated):
        print("No changes detected")
        return False

    # Print summary
    print("COURSE UPDATE SUMMARY")
    print("=" * 50)
    print(f"Added: {len(added)} | Removed: {len(removed)} | Updated: {len(updated)}\n")

    added.sort(key=lambda c: c.get('name', {}).get('en', ''))
    removed.sort(key=lambda c: c.get('name', {}).get('en', ''))
    updated.sort(key=lambda pair: pair[0].get('name', {}).get('en', ''))

    # Added courses
    if added:
        print(f"ADDED COURSES ({len(added)}):")
        for c in added:
            fields = get_important_fields(c)
            print(f"  + {fields['code']} — {truncate(fields['name_en'])}")
            print(f"       Credits: {fields['credits_min'] or 'N/A'}")
            print(f"       Start: {fields['start_date'] or 'N/A'} | End: {fields['end_date'] or 'N/A'}")
        print()


    # Removed courses
    if removed:
        print(f"REMOVED COURSES ({len(removed)}):")
        for c in removed:
            fields = get_important_fields(c)
            print(f"  - {fields['code']} — {truncate(fields['name_en'])}")
        print()

    # Updated courses
    if updated:
        print(f"UPDATED COURSES ({len(updated)}):")
        for old, new in updated:
            code = old.get("code", "N/A")
            name = truncate(old.get("name", {}).get("en", "N/A"))
            changes = diff_important_fields(get_important_fields(old), get_important_fields(new))
            if not changes:
                continue

            print(f"  ? {code} — {name}")
            for change in changes[:2]:
                field, old_val, new_val = change
                print(f"      * {field}:")
                print(f"          (old) {old_val or 'N/A'}")
                print(f"          (new) {new_val or 'N/A'}")
            if len(changes) > 2:
                print(f"      ... and {len(changes) - 2} more changes")
        print()

    # Log JSON
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "summary": {
            "added": len(added),
            "removed": len(removed),
            "updated": len(updated)
        },
        "details": {
            "added": [{
                "code": get_important_fields(c)["code"],
                "name": get_important_fields(c)["name_en"],
                "credits": get_important_fields(c)["credits_min"]
            } for c in added],
            "removed": [{
                "code": get_important_fields(c)["code"],
                "name": get_important_fields(c)["name_en"]
            } for c in removed],
            "updated": [{
                "code": get_important_fields(old)["code"],
                "name": get_important_fields(old)["name_en"],
                "changes": diff_important_fields(get_important_fields(old), get_important_fields(new))
            } for old, new in updated]
        }
    }

    os.makedirs("logs", exist_ok=True)
    log_file = f"logs/course_changes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(log_file, "w", encoding="utf-8") as f:
        json.dump(log_entry, f, indent=2, ensure_ascii=True)

    print(f"Change log saved to: {log_file}")

    if os.getenv("GITHUB_ACTIONS"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as f:
            f.write(f"has_changes=true\n")
            f.write(f"added_count={len(added)}\n")
            f.write(f"removed_count={len(removed)}\n")
            f.write(f"updated_count={len(updated)}\n")

    return True

if __name__ == "__main__":
    compare_courses("courses.json", "latest.json")
