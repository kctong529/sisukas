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
- [ ] Allow users to save filter sets on the server and generate a shareable link (no login required). https://github.com/kctong529/sisukas/issues/8
- [ ] Introduce user management features (for login and personal data management).
- [ ] Allow users to pin courses to keep them at the top.
- [ ] Add comment field where student feedbacks are shown.
- [ ] Improve accessibility for a more inclusive user experience.

### Data Management & Updates

- [ ] Evaluate the feasibility and necessity of fetching the latest course information from the Aalto Open API, balancing between real-time updates and caching.
- [ ] Support importing courses from a long string or fuzzy copied text.
- [ ] Export filtered results with customizable fields (JSON, CSV, Excel).

## Contributing

We welcome contributions of all kinds! Whether you want to share ideas, report issues, or improve the code, your input is valuable. Here’s how you can get involved:

### 💬 Discuss & Brainstorm

- Share ideas, ask questions, or start open-ended discussions in the [Discussions forum](https://github.com/kctong529/sisukas/discussions).

### 🛠 Improve & Fix

- Help improve the documentation.
- Monitor the [issue queue](https://github.com/kctong529/sisukas/issues) and [project backlog](https://github.com/users/kctong529/projects/1).
- Claim tasks, check priorities, and track ongoing work.

### 🚀 Suggest Features

- If you have an idea for a new feature or enhancement, create a new issue in the [project backlog](https://github.com/users/kctong529/projects/1).

### 🔧 Submitting Changes

- Fork the repository, make your changes, and submit a pull request.
- There are no strict formatting requirements for pull requests at the moment.

### ⭐ Show Your Support

Even if you’re not contributing code, you can support the project by giving it a ⭐ on GitHub! Every star helps increase visibility and encourages more contributions.

Your contributions help shape the project, and we appreciate every effort—big or small! 🎉

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
