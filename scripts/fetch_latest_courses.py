import os
import json
import requests
import sys

def main():
    api_key = os.getenv("AALTO_USER_KEY")
    if not api_key:
        print("ERROR: AALT_USER_KEY environment variable not set", file=sys.stderr)
        sys.exit(1)

    url = "https://course.api.aalto.fi:443/api/sisu/v1/courseunitrealisations"
    params = {
        "USER_KEY": api_key,
        "startTimeAfter": "2024-01-01",
    }
    headers = {"accept": "application/json"}

    print("Fetching latest courses from API...")
    response = requests.get(url, params=params, headers=headers)
    response.raise_for_status()
    data = response.json()

    with open("latest_fetch.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Saved latest fetch to latest_fetch.json (records: {len(data)})")

if __name__ == "__main__":
    main()
