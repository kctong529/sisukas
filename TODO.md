## To-Do List

### Core Functionality

- [ ] Implement filtering by course descriptions. https://github.com/kctong529/sisukas/issues/4
- [ ] Refactor the organization filter rule. https://github.com/kctong529/sisukas/issues/15
- [ ] Design and build Must Rules UI following conceptual models.
- [ ] Benchmark the actual performance gain of Must Rule implementation.
- [ ] Generate timeline based on course schedules.
- [ ] Integrate a study calendar for planning courses and tracking deadlines.
- [ ] Extract reusable filter logic into `sisukas-core` npm package.

### Frontend & UX Improvements

- [x] Improve responsive design for better usability across devices. https://github.com/kctong529/sisukas/issues/2
- [x] Enable users to save and reuse filter sets. https://github.com/kctong529/sisukas/issues/8
- [ ] Refactor frontend to TypeScript (or migrate to Svelte).
- [ ] Add navigation bar with login, documentation, and GitHub links.
- [ ] Allow users to pin selected courses to the top of the list.
- [ ] Add a comment field for student feedback.
- [ ] Enhance accessibility for a more inclusive experience.
- [ ] Refine the interface using Skeleton/TailwindCSS with DaisyUI components.

### User Management & Collaboration

- [ ] Build user authentication system with Express.js and SQL database.
- [ ] Design and implement database schema for user profiles and preferences.
- [ ] Implement user login/registration endpoints.
- [ ] Build user dashboard interface for personalized course tracking.
- [ ] Implement favorites/bookmarks API endpoints for saving courses.
- [ ] Implement feedback submission API endpoints.
- [ ] Add notification system for key registration deadlines and exam schedules.

### Data Management & Updates

- [ ] Use AWS CloudFront to cache `courses.json` and serve it from edge locations. https://github.com/kctong529/sisukas/issues/9
- [x] Automate daily course data updates via GitHub Actions workflow.
- [ ] Complete `sisu-wrapper` module for SISU teaching session data aggregation and normalization.
- [ ] Implement API input validation and normalization layer.
- [ ] Design and implement cache fetch/update lifecycle with clear cache invalidation strategy.
- [ ] Add async/await patterns consistently across all API endpoints.
- [ ] Add health check endpoint to filters API.
- [ ] Evaluate balance between performance and real-time course data fetching.
- [ ] Support importing courses from raw or loosely formatted text.
- [ ] Enable exporting filtered results in JSON, CSV, and Excel.

### Newsletter & Announcements

- [x] Automate newsletter delivery via GitHub Actions.
- [ ] Add basic email subscription management (unsubscribe, preferences, email validation).
- [ ] Build newsletter archive viewer for past issues, ensure consistency in Markdown + HTML.

### Development & Maintenance
- [x] Refactor the project and file structure for better maintainability. https://github.com/kctong529/sisukas/issues/3
- [x] Establish package management and code guidelines.
- [x] Set up Vitest for unit testing frontend filtering logic.
- [ ] Adopt MVC (Model-View-Controller) architecture pattern for backend services.
- [ ] Implement layered architecture (presentation, business logic, data access layers).
- [ ] Set up pytest for Python backend testing.
- [ ] Integrate mypy for static type checking in Python codebase.
- [ ] Integrate Black for consistent Python code formatting.
- [ ] Define and document terminology across the system. https://github.com/kctong529/sisukas/issues/14
- [ ] Expand test coverage for core filtering functionalities. https://github.com/kctong529/sisukas/issues/16
- [ ] Implement comprehensive test suite for backend services.