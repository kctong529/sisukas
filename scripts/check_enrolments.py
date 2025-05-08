import json
from datetime import datetime, timedelta

# Get today's date
today = datetime.today().date()

# Calculate the first day of last month
first_of_last_month = (today.replace(day=1) - timedelta(days=1)).replace(day=1)

# Calculate the date for the end of next week (Saturday of next week)
days_till_next_saturday = 7 if today.weekday() == 5 else (5 - today.weekday()) % 7
next_week_saturday = today + timedelta(days=days_till_next_saturday)

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


            # Filter: Start date must be at least from last month or later, and end date must be up to next week
            if start_date >= first_of_last_month and end_date <= next_week_saturday:
                print(f'{course["id"]}: {start_str} → {end_str}')

        except ValueError as e:
            print(f"Invalid date format in course {course.get('id')}: {e}")
