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


# List to store filtered courses
filtered_courses = []

# Iterate through the courses and check if today is within enrolment dates
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
                filtered_courses.append(course)

        except ValueError as e:
            print(f"Invalid date format in course {course.get('id')}: {e}")

# Sort the filtered courses by their enrolment end date
filtered_courses.sort(key=lambda x: datetime.strptime(x.get("enrolmentEndDate"), "%Y-%m-%d").date())

# Print the filtered and sorted courses
for course in filtered_courses:
    print(f'{course["id"]}: {course["enrolmentStartDate"]} → {course["enrolmentEndDate"]}')
