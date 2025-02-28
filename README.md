# Sisukas

[![CI Pipeline](https://github.com/kctong529/sisukas/actions/workflows/ci.yml/badge.svg)](https://github.com/kctong529/sisukas/actions/workflows/ci.yml)

A lightweight, fast alternative to the official SISU system for course filtering, [right here](https://sisukas.fly.dev/).

## Why?

Students are frustrated with the official SISU system due to:
- **Limited filters**: Finding relevant courses requires excessive manual searching.
- **Annoying navigation**: It displays only minimal details unless you click into each link.
- **Slow performance**: Multiple requests slow down the experience.

Sisukas provides a **faster, more user-friendly** way to browse and filter courses.
- **Fast and Efficient**: All data is preloaded, no additional requests.
- **Periods**: Intuitive drag-and-drop selection across the year.
- **Boolean Logic**: Combine filters with AND, OR for more refined results.
- **Keyword**: Narrow down results with keywords in course codes or names.
- **Date**: Filter courses by start and end dates to target specific time frames.
- **Major & Minor**: Predefined course lists for specific degrees.

## Balance

- **Compact**: All course information you'd need at a glance, no extra clicks.
- **Unique Toggle**: Show one entry per course code, merging duplicates.
- **Responsive Design**: Fully optimized for desktop and mobile devices.

## Technical Stack

- **Vanilla JavaScript**: Simple, lightweight, and runs efficiently in the browser.
- **Static JSON Database**: Course data is loaded once at startup, ensuring quick performance.

## Data Source

The course data (`courses.json`) was retrieved using the **Aalto Open API**, following the instructions at [3scale Aalto Open API Docs](https://3scale.apps.ocp4.aalto.fi/docs/swagger/open_courses_sisu).

The data was obtained using the `GET /courseunitrealisations` endpoint, with the parameter: `startTimeAfter=2024-01-01`.

Currently, the app uses a cached version of this data to ensure fast performance without making additional API calls.

## Running Locally

To test the application on your local machine, follow these steps:

1. **Clone the repository** to your local machine if you haven't already:

   ```sh
   git clone https://github.com/kctong529/sisukas.git
   cd sisukas
   ```

2. **Install dependencies** using npm:

   ```sh
   npm ci
   ```

3. **Build the project with Vite**:

   To build the project, run:

   ```sh
   npm run build
   ```

   This will bundle the project for production. After the build is complete, you'll have the necessary static files in the `/dist` folder.

   Opening `index.html` is useful for testing CSS styles and layout.

4. **Start a simple HTTP server** in your project directory:

   If you have Python installed, you can use Python's built-in HTTP server:

   ```sh
   cd dist
   python -m http.server 8000
   ```

   This will start a local server on port 8000. Alternatively, you can serve the files using any HTTP server of your choice.

5. **Open your browser** and go to the following URL:

   ```sh
   http://localhost:8000
   ```

   **Note**: `courses.json` is blocked when accessed directly via `file://` in the browser (due to browser security restrictions). The local server is required to load `courses.json` properly.

## To-Do List

### Core Functionality

- [ ] Enable filtering by course descriptions. https://github.com/kctong529/sisukas/issues/4
- [ ] Refactor organization filter rule. https://github.com/kctong529/sisukas/issues/15
- [ ] Add exclusion criteria such as "Not a math course".
- [ ] Implement support for nested sorting criteria.
- [ ] Automatically generate a timeline based on course schedules.
- [ ] Integrate a study calendar for better planning.

### User Experience & Accessibility

- [x] Enhance responsive design. https://github.com/kctong529/sisukas/issues/2
- [ ] Allow users to save filter sets. https://github.com/kctong529/sisukas/issues/8
- [ ] Introduce user management features.
- [ ] Allow users to pin courses to keep them at the top.
- [ ] Add comment field where student feedbacks are shown.
- [ ] Improve accessibility for a more inclusive user experience.

### Data Management & Updates

- [ ] Use AWS CloudFront to cache `courses.json` and serve it from edge locations to reduce origin traffic and save on Fly.io pay-as-you-go costs. https://github.com/kctong529/sisukas/issues/9
- [ ] Evaluate the feasibility and necessity of fetching the latest course information from the Aalto Open API, balancing between real-time updates and caching.
- [ ] Support importing courses from a long string or fuzzy copied text.
- [ ] Export filtered results with customizable fields (JSON, CSV, Excel).

### Development & Maintenance
- [ ] Refactor file structure. https://github.com/kctong529/sisukas/issues/3
- [ ] Define and document terminology across the system. https://github.com/kctong529/sisukas/issues/14
- [ ] Draft guidelines for package management.
- [ ] Evaluate and choose test packages.
- [ ] Create a draft set of unit tests.

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
