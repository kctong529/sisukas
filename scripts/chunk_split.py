import json
import math
import os

# Set working directory
WORK_DIR = "../course-browser/public/data"
input_file = os.path.join(WORK_DIR, "courses.json")

# Load the original JSON file
with open(input_file, "r", encoding="utf-8") as f:
    courses = json.load(f)

# Define number of chunks
chunk_count = 50
chunk_size = math.ceil(len(courses) / chunk_count)

# Create chunks and save them
for i in range(chunk_count):
    chunk = courses[i * chunk_size : (i + 1) * chunk_size]
    filename = os.path.join(WORK_DIR, f"courses_{i + 1}.json")
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(chunk, f, ensure_ascii=False, indent=2)
    print(f"Saved {filename} ({len(chunk)} items)")

print(f"Split {len(courses)} courses into {chunk_count} chunks in {WORK_DIR}")