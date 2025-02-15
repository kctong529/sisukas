# Sisukas

Sisukas is a web application designed to help students track and search for courses, their prerequisites, and course details in a user-friendly interface. Built as an alternative to the official SISU system, Sisukas addresses the frustration many students face with its limited filters and the annoying page design that only shows minimal course information without clicking through multiple links.

Deployed live on: [Sisukas](https://sisukas.fly.dev/)

## Features
- **Course Search**: Search for courses by various attributes like course name, teacher, and course code.
- **Filters**: Apply multiple filters to narrow down course results and find the exact courses you're looking for.
- **Fast Performance**: All data is loaded upfront, so no further requests are needed once the app is loaded, making it incredibly fast and responsive.
- **Responsive Design**: The app is optimized for both desktop and mobile usage.
- **Data Table**: View course details in a clean, organized table with columns for course code, name, teacher, and more.
- **User-friendly UI**: The interface is simple, clean, and intuitive, making it easy to find and explore courses without dealing with the excessive clicks and limited filtering options of SISU.

## Recommended Use Case
- **Filter by Start and End Date**: If you're looking for courses within a specific time frame, use the **start date** and **end date** filters to narrow down your search to courses available during the period you're interested in.
- **Filter out Exams**: If you're not interested in exams and want to focus only on lectures, you can use the keyword **"Lecture"** in the course name filter to exclude exams from the search results.

## Motivation
Students are often frustrated with the SISU system's:
- **Limited filters**: The official SISU system doesn't offer the flexibility to filter by multiple criteria easily.
- **Annoying page layout**: Most of the information is hidden behind multiple links, making it tedious to explore course details.
  
Sisukas aims to solve these problems by providing a straightforward and comprehensive view of courses with better filtering options and less clicking. Additionally, the app is designed to be **fast**, as all the data is loaded at once without making additional requests, ensuring a smoother user experience.

## Technologies Used
- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Database**: Static database (can be expanded or replaced with dynamic data if required)

## How to Use
1. Visit [Sisukas](https://sisukas.fly.dev/).
2. Use the filters to search for specific courses by various criteria such as course name, teacher, and more.
3. Use the **start date** and **end date** filters to narrow down the courses within a specific time period.
4. Use the **course name** filter and enter **"Lecture"** to exclude exams from the results.
5. View the results in the table below, with all relevant course information displayed directly.

## Setup and Development
1. Clone the repository:
    ```bash
    git clone https://github.com/your-username/sisukas.git
    ```

2. Navigate into the project directory:
    ```bash
    cd sisukas
    ```

3. Start a local server using Python (ensure you have Python installed):
    ```bash
    python -m http.server 8000
    ```

4. Open a web browser and visit [http://localhost:8000](http://localhost:8000) to view the application locally.

Note: Opening the `index.html` file directly in a browser might block the loading of `courses.json` due to security restrictions, so using a local server is recommended for testing.

### Steps to Contribute:
1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a pull request with a description of the changes

## License
This project is open-source and available under the MIT License.
