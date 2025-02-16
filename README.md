# Sisukas

A lightweight, fast alternative to the official SISU system for course filtering.

## Why?

Students are frustrated with the official SISU system due to:
- **Limited filters**: Finding relevant courses requires excessive manual searching.
- **Annoying navigation**: The system displays only minimal details unless you click into each course link.
- **Slow performance**: Multiple requests slow down the experience.

Sisukas provides a **faster, more user-friendly** way to browse and filter courses.

## Features

- **Fast**: All data is preloaded, so there are no additional requests slowing down interactions.
- **Better Filtering**:
  - Filter by **start and end dates** to find courses in a specific period.
  - Use **keywords in course codes or names** (e.g., `"CS"`, `"ELEC"`, `"MS"`, or `"Design"`) to narrow results.
  - Exclude **exams** by filtering `"Lecture"` in course names.
- **Compact Information**: No unnecessary clicks—important details are displayed immediately.
- **(Upcoming Feature) Filter by description**: Search for courses with relevant topics.

## Technical Stack

- **Vanilla JavaScript**: Simple, lightweight, and runs efficiently in the browser.
- **Static JSON Database**: Course data is loaded once at startup, ensuring quick performance.

## Data Source

The course data (`courses.json`) was retrieved using the **Aalto Open API**, following the instructions at [3scale Aalto Open API Docs](https://3scale.apps.ocp4.aalto.fi/docs/swagger/open_courses_sisu).

The data was obtained using the `GET /courseunitrealisations` endpoint, with the parameter: `startTimeAfter=2024-01-01`.

Currently, the app uses a cached version of this data to ensure fast performance without making additional API calls.

## Deployment

Sisukas is live at: [Sisukas](https://sisukas.fly.dev/)

## Running Locally

To test the application on your local machine, follow these steps:

1. **Clone the repository** to your local machine if you haven't already:

   ```sh
   git clone https://github.com/kctong529/sisukas.git
   cd sisukas
   ```

   Opening `index.html` is useful for testing CSS styles and layout.

2. **Start a simple HTTP server** in your project directory:

   If you have Python installed, you can use Python's built-in HTTP server:

   ```sh
   python -m http.server 8000
   ```

   This will start a local server on port 8000.

3. **Open your browser** and go to the following URL:

   ```sh
   http://localhost:8000
   ```

   **Note**: `courses.json` is blocked when accessed directly via `file://` in the browser (due to browser security restrictions). The local server is required to load `courses.json` properly.

## To-Do List

### Core Functionality

- [ ] Refactor the file structure to improve maintainability. https://github.com/kctong529/sisukas/issues/3
- [ ] Enable filtering by course descriptions. https://github.com/kctong529/sisukas/issues/4
- [ ] Automatically label periods based on course dates. https://github.com/kctong529/sisukas/issues/5
- [ ] Add predefined filters such as "Starts in the future," "DSD curriculum," "CS minor," and "Finnish language course." https://github.com/kctong529/sisukas/issues/6
- [ ] Implement support for nested sorting criteria.
- [ ] Automatically generate a timeline based on course schedules.
- [ ] Integrate a study calendar for better planning.

### User Experience & Accessibility

- [ ] Enhance responsive design for a smoother mobile experience. https://github.com/kctong529/sisukas/issues/2
- [ ] Introduce user management features (for login and personal data management).
- [ ] Allow users to pin courses to keep them at the top.
- [ ] Enable saving and loading of the current view (for logged-in users).
- [ ] Add comment field where student feedbacks are shown.
- [ ] Improve accessibility for a more inclusive user experience.

### Data Management & Updates

- [ ] Evaluate the feasibility and necessity of fetching the latest course information from the Aalto Open API, balancing between real-time updates and caching.
- [ ] Support importing courses from a long string or fuzzy copied text.
- [ ] Export filtered results with customizable fields (JSON, CSV, Excel).

## Contributing

Thank you for your interest in contributing to Sisukas! To get started:

1. Fork the repository.
2. Make your changes.
3. Submit a pull request.

We also appreciate any stars ⭐ you give to the project to show your support!

### Where to Collaborate

To keep things organized and collaborate effectively, we use the following GitHub tools:

- **Issue Tracker**: For reporting bugs, submitting feature requests, or tracking ongoing work, head to our [Issue Tracker](https://github.com/kctong529/sisukas/issues).
  You'll find a list of open and closed issues and be able to submit new ones.

- **Task Management**: We use [GitHub Projects](https://github.com/users/kctong529/projects/1) to manage tasks and track progress. You can claim tasks, check on priorities, and view the status of ongoing work.

- **Discussions**: For more open-ended conversations, brainstorming ideas, or asking questions, visit our [Discussions page](https://github.com/kctong529/sisukas/discussions).
  This is a great space to collaborate and engage with the community.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
