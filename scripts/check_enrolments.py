import json
from datetime import datetime, timedelta

# Get today's date
today = datetime.today().date()

# Calculate the date for 2 months ago
two_months_ago = today - timedelta(days=60)  # Approximately 2 months ago

# Calculate the date for 3 weeks from today
three_weeks_from_today = today + timedelta(weeks=3)

# Load the JSON file
with open("public/data/courses.json") as f:
    courses = json.load(f)

# Iterate through the courses and check if the criteria are fulfilled
for course in courses:
    start_str = course.get("enrolmentStartDate")
    end_str = course.get("enrolmentEndDate")

    if start_str and end_str:
        try:
            start_date = datetime.strptime(start_str, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_str, "%Y-%m-%d").date()

            # Filter: 
            # 1. Exclude courses that started more than 2 months ago
            # 2. Include courses where the enrolment ends within the next 3 weeks but not in the past
            if start_date >= two_months_ago and today <= end_date <= three_weeks_from_today:
                print(f'{course["id"]}: {start_str} → {end_str}')

        except ValueError as e:
            print(f"Invalid date format in course {course.get('id')}: {e}")
