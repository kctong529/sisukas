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

def format_date_range(start, end):
    """Format date range as 'd.m.–d.m.' without year, or 'N/A'."""
    if start and end:
        return f"{start.day}.{start.month} – {end.day}.{end.month}"
    return "N/A"

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
            <th style="width: 20%; word-break: break-word; white-space: normal;">Course Code</th>
            <th>Course Name</th>
            <th style="width: 13%; word-break: break-word; white-space: normal;">Course Dates</th>
            <th style="width: 13%; word-break: break-word; white-space: normal;">Enrolment Period</th>
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

    course_dates = format_date_range(start_date, end_date)
    enrolment_dates = format_date_range(enrolment_start, enrolment_end)

    return f"""
    <tr>
        <td style="width: 20%; word-break: break-word; white-space: normal;">{course_code}</td>
        <td><a href="{course_link}" target="_blank">{course_name_en}</a></td>
        <td style="width: 13%; word-break: break-word; white-space: normal;">{course_dates}</td>
        <td style="width: 13%; word-break: break-word; white-space: normal;">{enrolment_dates}</td>
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
            table {{
                border-collapse: collapse;
                width: 98%;
                margin: 20px auto;
            }}
            h2 {{
                text-align: center;
                color: #610396;
            }}
            body {{
                font-family: Arial, sans-serif;
                background-color: #f4f4f4;
            }}
            a {{
                color: #610396;
                text-decoration: none;
            }}
            a:hover {{
                text-decoration: underline;
            }}
            hr {{
                border: 0;
                border-top: 1px solid #ddd;
                margin: 40px 0;
            }}
            .content-wrapper {{
                background-color: #ffffff;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                margin-top: 20px;
            }}
            .newsletter-table {{
                border-collapse: collapse;
                width: 100%;
                margin-top: 20px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            }}
            .newsletter-table th, .newsletter-table td {{
                border: 1px solid #ccc;
                padding: 6px;
                text-align: left;
            }}
            .newsletter-table th {{
                background-color: #610396;
                color: white;
            }}
        </style>
    </head>
    <body>
        <table width="100%" cellpadding="0" cellspacing="0" class="content-wrapper">
            <tr>
                <td align="center">
                    <table width="600">
                        <tr>
                            <td>
                                <h2>{newsletter_title}</h2>
                                <p>Stay informed about upcoming course enrolment periods at Aalto. Below, you’ll find a list of courses with enrolment periods closing soon — make sure to check them out in time.</p>

                                <h3>📅 Upcoming Course Enrolments</h3>
                                <table class="newsletter-table">
                                    {generate_table_header()}
    """

    if other_courses:
        for course in other_courses:
            html_content += generate_course_row(course)
    else:
        html_content += "<tr><td colspan='4'>No upcoming course enrolments.</td></tr>"

    html_content += f"""
                                </table>

                                <p>Thanks for staying organised with Sisukas — wishing you a smooth and successful semester ahead!</p>
                                <hr>

                                <p style="margin-top: 20px; font-size: 13px; color: #777; text-align: center;">
                                    🚀 Built by students, for students: 
                                    <a href="https://sisukas.fly.dev/" target="_blank" style="color: #610396;">Sisukas</a> — a lightweight, fast alternative to the SISU system for course filtering. 
                                    Nothing more, nothing less (for now). You can also contribute on 
                                    <a href="https://github.com/kctong529/sisukas" target="_blank" style="color: #610396;">GitHub</a>.
                                </p>
                                <hr>

                                <h3>📝 Upcoming Exams</h3>
                                <table class="newsletter-table">
                                    {generate_table_header()}
    """

    if exam_courses:
        for course in exam_courses:
            html_content += generate_course_row(course)
    else:
        html_content += "<tr><td colspan='4'>No upcoming exams.</td></tr>"

    html_content += """
                                </table>
                                <hr>
                                <p style="font-size: 13px; color: #777; text-align: center;">
                                For questions or feedback, please contact us at <a href="mailto:kichun.tong@aalto.fi" style="color: #610396;">kichun.tong@aalto.fi</a>.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
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
