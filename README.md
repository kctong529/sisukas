# Sisukas

[![CI Pipeline](https://github.com/kctong529/sisukas/actions/workflows/ci.yml/badge.svg)](https://github.com/kctong529/sisukas/actions/workflows/ci.yml)
[![PyPI](https://img.shields.io/pypi/v/sisu_wrapper?label=sisu-wrapper)](https://pypi.org/project/sisu-wrapper/)

A lightweight, fast alternative to the official SISU system for course filtering, [right here](https://sisukas.eu/).

> [!IMPORTANT]
> If you're a university student in the Finnish education system, you’ve likely encountered the frustrations of the SISU system. With limited filters, navigation that hides key details behind multiple clicks, and a confusing pagination system that makes it easy to lose track, finding courses can be unnecessarily tedious. Slow performance only adds to the hassle, making the whole experience more cumbersome than it needs to be. On top of that, the lack of curriculum information makes planning your studies more difficult.

Sisukas offers a faster, more intuitive way to browse and filter courses:

- Quick response with preloaded data, with no additional requests
- Intuitive drag-and-drop selection across periods
- Refined search using Boolean logic (AND, OR) for more specific results
- Filter courses by start and end dates to focus on specific time frames
- Predefined course lists for specific majors and minors
- Share filter configurations via short URLs

> [!NOTE]
> Sisukas strikes the right balance in presenting course information. It features a compact layout that displays all necessary course details at a glance, with no extra clicks. A unique toggle merges duplicate entries, showing only one per course code. The app is fully responsive, ensuring smooth performance across both desktop and mobile devices.

> [!TIP]
> Want to stay informed about important course details, key registration deadlines, and exam schedules? Sisukas now features a public newsletter! Check out the latest issue or subscribe [here](https://sisukas.eu/newsletter.html).

## How It Works

The Sisukas frontend is built with Vanilla JavaScript, chosen for its simplicity, lightweight nature, and fast performance in the browser. To ensure quick access, it uses IndexedDB-based caching to efficiently load course data once at startup, eliminating unnecessary network requests. The app's development process is optimized with the Vite build tool, which supports ECMAScript modules and handles cache invalidation efficiently. Vitest is used to perform fast, reliable unit tests, ensuring that key features like filtering, sorting, and data handling work correctly with minimal overhead. A serverless API backend (Google Cloud Run) handles filter sharing functionality, allowing users to save and share filter configurations via short URLs. Finally, for deployment, Fly.io distributes the app across multiple edge locations for global access, while Docker ensures consistent, containerized environments.

> [!NOTE]
> The course data (`courses.json`) was retrieved using the Aalto Open API, following the instructions at [3scale Aalto Open API Docs](https://3scale.apps.ocp4.aalto.fi/docs/swagger/open_courses_sisu). The data was obtained using the `GET /courseunitrealisations` endpoint, with the parameter: `startTimeAfter=2024-01-01`. A GitHub Actions workflow automatically checks for course updates daily and commits changes to the repository.

> [!IMPORTANT]
> The app uses a cached version of this data with HTTP conditional requests (If-Modified-Since) to ensure fast performance while staying up-to-date. The browser will automatically fetch updates only when the data has changed on the server.

## Running Locally

To test the application on your local machine, follow these steps:

1. Clone the repository: `git clone https://github.com/kctong529/sisukas.git`
2. Navigate to the frontend directory: `cd sisukas/course-browser`
3. Install dependencies: `npm ci`
4. Start the development server: `npm run dev`

This will start the Vite development server and provide a URL in the console (e.g., `http://localhost:5173`). Simply open this URL in your browser.

> [!NOTE]
> If you're interested in building the app for production, you can run `npm run build`. This will bundle the project for production and create the necessary static files in the `/dist` folder. You can serve the files from the `/dist` directory using any HTTP server of your choice (e.g. `python -m http.server`).

> [!TIP]
> `courses.json` is blocked when accessed directly via `file://` in the browser (due to browser security restrictions). Using the local server ensures proper loading of `courses.json`.

## To-Do List

### Core Functionality

- [ ] Implement filtering by course descriptions. https://github.com/kctong529/sisukas/issues/4
- [ ] Refactor the organization filter rule. https://github.com/kctong529/sisukas/issues/15
- [ ] Design and build Must Rules UI following conceptual models.
- [ ] Automatically generate a timeline based on course schedules.
- [ ] Integrate a study calendar for planning courses and tracking deadlines.
- [ ] Extract reusable filter logic into `sisukas-core` npm package.

### Frontend & UX Improvements

- [x] Improve responsive design for better usability across devices. https://github.com/kctong529/sisukas/issues/2
- [x] Enable users to save and reuse filter sets. https://github.com/kctong529/sisukas/issues/8
- [ ] Integrate Svelte framework for cleaner architecture and maintainable components.
- [ ] Allow users to pin selected courses to the top of the list.
- [ ] Add a comment field for student feedback.
- [ ] Enhance accessibility for a more inclusive experience.
- [ ] Refine the interface using Skeleton/TailwindCSS with DaisyUI components.

### User Management & Collaboration

- [ ] Implement user authentication and profile management.
- [ ] Build a user dashboard interface for personalized course tracking.
- [ ] Add notification system for key registration deadlines and exam schedules.

### Data Management & Updates

- [ ] Use AWS CloudFront to cache `courses.json` and serve it from edge locations. https://github.com/kctong529/sisukas/issues/9
- [x] Workflow to fetch the course API with diff report and automatic commit.
- [ ] Build REST microservice for SISU teaching session data aggregation and normalization.
- [ ] Add a health check endpoint to filters API.
- [ ] Evaluate balance between performance and real-time course data fetching.
- [ ] Support importing courses from raw or loosely formatted text.
- [ ] Enable exporting filtered results in JSON, CSV, and Excel.

### Newsletter & Announcements

- [x] GitHub Action to send newsletter updates automatically.
- [ ] Build workflow for drafting, previewing, and scheduling issues.
- [ ] Add basic email subscription management (unsubscribe, preferences, email validation).
- [ ] Build newsletter archive viewer for past issues, ensure consistency in Markdown + HTML.

### Development & Maintenance
- [x] Refactor the project and file structure for better maintainability. https://github.com/kctong529/sisukas/issues/3
- [ ] Define and document terminology across the system. https://github.com/kctong529/sisukas/issues/14
- [ ] Write unit tests for core filtering functionalities. https://github.com/kctong529/sisukas/issues/16
* [ ] Establish package management and code guidelines.
* [ ] Evaluate and select testing frameworks for frontend and backend.

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

### 📖 Add Your Own Curriculum

- Anyone can contribute by populating the YAML file(s) with their own curriculum—it only takes a few minutes!
- This is a simple way to expand the project and help others by sharing useful learning information.

### 🔧 Submitting Changes

- Fork the repository, make your changes, and submit a pull request.
- There are no strict formatting requirements for pull requests at the moment.

### ⭐ Show Your Support

Even if you’re not contributing code, you can support the project by giving it a ⭐ on GitHub! Every star helps increase visibility and encourages more contributions.

Your contributions help shape the project, and we appreciate every effort—big or small! 🎉

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
