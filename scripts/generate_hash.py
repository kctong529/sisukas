import json
import hashlib
import datetime
import sys

input_file = sys.argv[1]       # e.g. latest_fetch.json
output_file = sys.argv[2]      # e.g. public/data/courses.hash.json

# Load JSON content
with open(input_file, "r", encoding="utf-8") as f:
    data = f.read()

# Compute hash
hash_sha256 = hashlib.sha256(data.encode("utf-8")).hexdigest()

# Save hash + timestamp
hash_info = {
    "hash": hash_sha256,
    "timestamp": datetime.datetime.now(datetime.UTC).isoformat() + "Z"
}

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(hash_info, f, indent=2)

print(f"Generated hash {hash_sha256} for {input_file}")