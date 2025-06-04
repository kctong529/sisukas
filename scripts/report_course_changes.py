import json

def diff_fields(old, new, path=""):
    changes = []
    for key in old:
        current_path = f"{path}.{key}" if path else key
        if key not in new:
            changes.append(f"{current_path} (removed)")
        elif isinstance(old[key], dict) and isinstance(new[key], dict):
            changes.extend(diff_fields(old[key], new[key], current_path))
        elif old[key] != new[key]:
            changes.append(current_path)
    for key in new:
        current_path = f"{path}.{key}" if path else key
        if key not in old:
            changes.append(f"{current_path} (added)")
    return changes

def compare_courses(old_path, new_path):
    with open(old_path, "r", encoding="utf-8") as f:
        old_courses = json.load(f)

    with open(new_path, "r", encoding="utf-8") as f:
        new_courses = json.load(f)

    old_by_id = {course["id"]: course for course in old_courses}
    new_by_id = {course["id"]: course for course in new_courses}

    added = [c for cid, c in new_by_id.items() if cid not in old_by_id]
    removed = [c for cid, c in old_by_id.items() if cid not in new_by_id]
    updated = [(old_by_id[cid], new_by_id[cid]) for cid in new_by_id if cid in old_by_id and new_by_id[cid] != old_by_id[cid]]

    print(f"📊 Added Courses ({len(added)}):")
    for c in added:
        print(f"  + {c['code']} — {c['name']['en']}")

    print(f"\n📊 Removed Courses ({len(removed)}):")
    for c in removed:
        print(f"  - {c['code']} — {c['name']['en']}")

    print(f"\n📊 Updated Courses ({len(updated)}):")
    for old, new in updated:
        print(f"  {old['code']} — {old['name']['en']}")
        changed_fields = diff_fields(old, new)
        for field in changed_fields:
            print(f"    * {field}")

if __name__ == "__main__":
    compare_courses("public/data/courses.json", "latest_fetch.json")
