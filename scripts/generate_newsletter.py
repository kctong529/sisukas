import json
from datetime import datetime, timedelta

# Helper functions for date parsing and course filtering
def parse_date(date_str: str) -> datetime.date:
    """Parse a date string into a datetime.date object or return None if the format is invalid."""
    if date_str:
        try:
            return datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return None
    return None  # Return None if the date_str is None or empty

def filter_courses(courses, start_threshold, end_threshold, today):
    """Filter courses based on the enrolment start and end dates."""
    filtered_courses = []
    for course in courses:
        start_date = parse_date(course.get('enrolmentStartDate'))
        end_date = parse_date(course.get('enrolmentEndDate'))

        if start_date and end_date:
            # Skip courses that have already ended
            if end_date < today:
                continue
            # Ensure the course is within the date range
            if start_date >= start_threshold and end_date <= end_threshold:
                filtered_courses.append(course)
    return filtered_courses

def split_exam_and_other_courses(courses):
    """Split courses into exam courses and other courses based on 'exam' in the name."""
    exam_courses = []
    other_courses = []
    for course in courses:
        name_en = course['name'].get('en', '').lower()
        if 'exam' in name_en:
            exam_courses.append(course)
        else:
            other_courses.append(course)
    return exam_courses, other_courses

def deduplicate_courses(courses):
    """Remove duplicate courses based on course code, name, and dates."""
    seen = set()
    unique_courses = []
    for course in courses:
        key = (
            course.get('code'),
            course['name'].get('en'),
            course.get('startDate'),
            course.get('endDate'),
            course.get('enrolmentStartDate'),
            course.get('enrolmentEndDate')
        )
        if key not in seen:
            seen.add(key)
            unique_courses.append(course)
    return unique_courses

# HTML generation functions
def generate_table_header():
    """Generate the header for the course enrolment table."""
    return """
    <thead>
        <tr>
            <th>Course Code</th>
            <th>Course Name</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Enrolment Start</th>
            <th>Enrolment End</th>
        </tr>
    </thead>
    """

def generate_course_row(course):
    """Generate a table row for a single course."""
    course_code = course['code']
    course_name_en = course['name']['en']
    course_unit_id = course['courseUnitId']
    start_date = parse_date(course.get('startDate'))
    end_date = parse_date(course.get('endDate'))
    enrolment_start = parse_date(course.get('enrolmentStartDate'))
    enrolment_end = parse_date(course.get('enrolmentEndDate'))

    course_link = f"https://sisu.aalto.fi/student/courseunit/{course_unit_id}/brochure"

    return f"""
    <tr>
        <td>{course_code}</td>
        <td><a href="{course_link}" target="_blank">{course_name_en}</a></td>
        <td>{start_date if start_date else 'N/A'}</td>
        <td>{end_date if end_date else 'N/A'}</td>
        <td>{enrolment_start if enrolment_start else 'N/A'}</td>
        <td>{enrolment_end if enrolment_end else 'N/A'}</td>
    </tr>
    """

def generate_html(exam_courses, other_courses):
    """Generate the full HTML content for the newsletter."""

    today = datetime.today()
    year = today.year
    week_number = today.isocalendar().week
    newsletter_title = f"Sisukas Newsletter ({year} Week {week_number})"

    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Upcoming Course Enrolments</title>
        <style>
            .container table {{
                border-collapse: collapse;
                width: 90%;
                margin: 20px auto;
            }}
            th, td {{ border: 1px solid #ccc; padding: 10px; text-align: left; }}
            th {{ background-color: #610396; color: white; }}
            h2 {{ text-align: center; color: #610396; }}
            body {{ font-family: Arial, sans-serif; background-color: #f4f4f4; }}
            .container {{ width: 90%; margin: 20px auto; padding: 20px; background-color: white; }}
            a {{ color: #610396; text-decoration: none; }}
            a:hover {{ text-decoration: underline; }}
            details {{ margin: 20px auto; width: 100%; }}
            summary {{ font-weight: bold; margin: 10px 0; cursor: pointer; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h2>{newsletter_title}</h2>
            <p>Stay informed about upcoming course enrolment periods at Aalto. Below, you’ll find a list of courses with enrolment periods closing soon — make sure to check them out in time.</p>
            
            <h3>📅 Upcoming Course Enrolments</h3>
            <table>
            """
    html_content += generate_table_header()

    for course in other_courses:
        html_content += generate_course_row(course)

    html_content += """
            </table>
            
            <details>
              <summary>📝 Show Exams ({})</summary>
              <table>
                """.format(len(exam_courses))

    html_content += generate_table_header()

    for course in exam_courses:
        html_content += generate_course_row(course)

    html_content += """
              </table>
            </details>

            <p>🚀 Thanks for staying organised with Sisukas — wishing you a smooth and successful semester ahead!</p>
        </div>
    </body>
    </html>
    """
    return html_content

# Main logic
def main():
    """Main logic to filter courses and generate the HTML newsletter."""
    today = datetime.today().date()

    # Date thresholds for the next 2 months and 3 weeks
    two_months_ago = today - timedelta(days=60)
    three_weeks_from_today = today + timedelta(weeks=3)

    # Load the courses JSON
    with open("public/data/courses.json") as f:
        courses = json.load(f)

    # Filter the courses
    filtered_courses = filter_courses(courses, two_months_ago, three_weeks_from_today, today)

    # Deduplicate them
    filtered_courses = deduplicate_courses(filtered_courses)
    
    # Sort the courses by enrolment end date
    filtered_courses.sort(key=lambda x: parse_date(x.get("enrolmentEndDate")))

    # Split the courses into exam and other
    exam_courses, other_courses = split_exam_and_other_courses(filtered_courses)

    # Generate the HTML content
    html_content = generate_html(exam_courses, other_courses)

    # Write the HTML to a file
    with open("public/newsletter.html", "w") as f:
        f.write(html_content)

    print(f"Generated newsletter HTML with {len(filtered_courses)} courses.")

# Run the script
if __name__ == "__main__":
    main()
