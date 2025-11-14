import os
import sys
import json
import argparse
from datetime import datetime, timedelta

# -------------------------------
# Helper functions
# -------------------------------

def require_file(path: str):
    """Ensure the given path exists and is a file."""
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Source file not found: {path}")

def load_json_file(path: str):
    """Load JSON and raise a friendly error if invalid."""
    try:
        with open(path, "r") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in {path}: {e}") from e

def ensure_writable(path: str):
    """Check if a file can be created/written."""
    directory = os.path.dirname(path) or "."
    if not os.path.isdir(directory):
        raise NotADirectoryError(f"Output directory does not exist: {directory}")
    try:
        with open(path, "w") as f:
            f.write("")  # test write
    except Exception as e:
        raise PermissionError(f"Cannot write to output file '{path}': {e}") from e

def parse_date(date_str: str) -> datetime.date:
    """Parse a date string into a datetime.date object or return None if the format is invalid."""
    if date_str:
        try:
            return datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return None
    return None  # Return None if the date_str is None or empty

def filter_courses(courses, start_threshold, start_threshold_2, end_threshold, today):
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
            # Include courses that will open registration soon
            elif today <= start_date <= start_threshold_2:
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

def split_upcoming_open_and_deadlines(courses, threshold):
    """
    Split courses into:
    - upcoming_open: enrolment closes after the threshold date
    - upcoming_close: enrolment is already close or closes before the threshold
    """
    upcoming_open = []
    upcoming_close = []
    for course in courses:
        end_date = parse_date(course.get('enrolmentEndDate'))
        if end_date and end_date <= threshold:
            upcoming_close.append(course)
        else:
            upcoming_open.append(course)
    return upcoming_open, upcoming_close

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

def generate_category_table(title, courses):
    """Generate an HTML table for a category of courses."""
    html = f"""
        <h3>{title}</h3>
        <table class="newsletter-table">
            {generate_table_header()}
    """

    if courses:
        for course in courses:
            html += generate_course_row(course)
    else:
        html += "<tr><td colspan='4'>No courses in this category.</td></tr>"

    html += "</table><hr>"

    return html

def generate_html(upcoming_open, upcoming_close, exam_courses):
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
                                <p>
                                    We’re currently working on a refreshed newsletter layout that will roll out soon, 
                                    along with more customizable content delivery options to make these updates even more useful for you.  
                                    Until then, here are the latest course enrolment periods you might want to keep an eye on.
                                </p>
                                <p>
                                    An unsubscribe button will also be added in the upcoming update.  
                                    If you prefer to stop receiving these messages right now, just contact 
                                    <a href="mailto:kichun.tong@aalto.fi" style="color: #610396;">kichun.tong@aalto.fi</a> 
                                    or message @kctong529 on Telegram. It can be handled immediately.
                                </p>
    """

    html_content += f"""
        {generate_category_table("📅 Upcoming Course Enrolment Deadlines", upcoming_close)}

        {generate_category_table("📅 Enrolments Opening Soon or Recently", upcoming_open)}

        <p>Thanks for staying organised with Sisukas. We wish you a smooth and successful semester ahead!</p>
        <hr>
        <p style="margin-top: 20px; font-size: 13px; color: #777; text-align: center;">
            🚀 Built by students, for students: 
            <a href="https://sisukas.fly.dev/" target="_blank" style="color: #610396;">Sisukas</a> — a lightweight, fast alternative to the SISU system for course filtering. 
            Nothing more, nothing less (for now). You can also contribute on 
            <a href="https://github.com/kctong529/sisukas" target="_blank" style="color: #610396;">GitHub</a>.
        </p>

        {generate_category_table("📝 Upcoming Exams", exam_courses)}
    """

    html_content += """
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

# -------------------------------
# Main logic with argparse
# -------------------------------

def main():
    """Main logic to filter courses and generate the HTML newsletter."""
    parser = argparse.ArgumentParser(
        description="Generate Sisukas newsletter HTML from course JSON."
    )
    parser.add_argument("source", help="Path to the courses.json file")
    parser.add_argument("-o", "--output", default="newsletter.html",
                        help="Output HTML file path (default: newsletter.html)")

    args = parser.parse_args()

    try:
        # Validate input JSON file
        require_file(args.source)

        # Validate output path *before* doing work
        ensure_writable(args.output)

        # Load JSON with robustness
        courses = load_json_file(args.source)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    today = datetime.today().date()
    three_months_ago = today - timedelta(days=90)
    two_weeks_from_day = today + timedelta(weeks=2)
    three_weeks_from_day = today + timedelta(weeks=3)

    # Load the courses JSON
    with open(args.source) as f:
        courses = json.load(f)

    # Filter the courses
    filtered_courses = filter_courses(
        courses, three_months_ago, two_weeks_from_day, three_weeks_from_day, today
    )

    # Deduplicate them
    filtered_courses = deduplicate_courses(filtered_courses)
    
    # Sort the courses by enrolment end date
    filtered_courses.sort(key=lambda x: parse_date(x.get("enrolmentEndDate")))

    # Split the courses into exam and other
    exam_courses, other_courses = split_exam_and_other_courses(filtered_courses)

    # Split other courses into those with future enrolment opens and those closing soon/already open
    upcoming_open, upcoming_close = split_upcoming_open_and_deadlines(
        other_courses, three_weeks_from_day
    )

    # Generate the HTML content
    html_content = generate_html(upcoming_open, upcoming_close, exam_courses)

    # Write the HTML to a file
    with open(args.output, "w") as f:
        f.write(html_content)

    print(f"Generated newsletter HTML -> {args.output}")
    print(f"Total included courses: {len(filtered_courses)}")

if __name__ == "__main__":
    main()
