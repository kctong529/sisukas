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
To test the application locally, use a simple HTTP server:

```sh
python -m http.server 8000
```

Then, open `http://localhost:8000` in your browser.

## To-Do List

### Core Functionality

- [ ] #3
- [ ] #4
- [ ] #5
- [ ] #6
- [ ] Implement support for nested sorting criteria.
- [ ] Automatically generate a timeline based on course schedules.
- [ ] Integrate a study calendar for better planning.

### User Experience & Accessibility

- [ ] #2
- [ ] Introduce user management features (for login and personal data management).
- [ ] Allow users to pin courses to keep them at the top.
- [ ] Enable saving and loading of the current view (for logged-in users).
- [ ] Add comment field where student feedbacks are shown.
- [ ] Improve accessibility for a more inclusive user experience.

### Data Management & Updates

- [ ] Evaluate the feasibility and necessity of fetching the latest course information from the Aalto Open API, balancing between real-time updates and caching.
- [ ] Support importing courses from a long string or fuzzy copied text.
- [ ] Export filtered results with customizable fields (JSON, CSV, Excel).

## Contribution
Contributions are welcome! If you'd like to improve the project:
1. Fork the repository.
2. Make your changes.
3. Submit a pull request.

A ⭐ on the repository is always appreciated!

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
