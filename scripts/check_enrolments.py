import json
from datetime import datetime

# Load the JSON file
with open("public/data/courses.json") as f:
    courses = json.load(f)

today = datetime.today().date()

# Iterate through the courses and check if today is within enrolment dates
for course in courses:
    start_str = course.get("enrolmentStartDate")
    end_str = course.get("enrolmentEndDate")

    if start_str and end_str:
        try:
            start_date = datetime.strptime(start_str, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_str, "%Y-%m-%d").date()

            if start_date <= today <= end_date:
                print(f'{course["id"]}: {start_str} → {end_str}')
        except ValueError as e:
            print(f"Invalid date format in course {course.get('id')}: {e}")
