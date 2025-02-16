# Sisukas

A lightweight, fast alternative to the official SISU system for course filtering.

## Why?
Students are frustrated with the official SISU system due to:
- **Limited filters**: Finding relevant courses requires excessive manual searching.
- **Annoying navigation**: The system displays only minimal details unless you click into each course link.
- **Slow performance**: Multiple requests slow down the experience.

Sisukas provides a **faster, more user-friendly** way to browse and filter courses.

## Features
- **Fast & Efficient**: All data is preloaded, so there are no additional requests slowing down interactions.
- **Better Filtering**:
  - Filter by **start and end dates** to find courses in a specific period.
  - Use **keywords in course codes or names** (e.g., `"CS"`, `"ELEC"`, `"MS"`, or `"Design"`) to narrow results.
  - Exclude **exams** by filtering `"Lecture"` in course names.
- **Compact & Clear Information**: No unnecessary clicks—important details are displayed immediately.

## Technical Stack
- **Vanilla JavaScript**: Simple, lightweight, and runs efficiently in the browser.
- **Static JSON Database**: Course data is loaded once at startup, ensuring quick performance.

## Filtering Examples
You can refine your search using various filtering techniques:
- **Find courses in a specific period**: Define a **start** and **end** date.
- **Search by department**: Use **"CS"**, **"ELEC"**, **"MS"** in course codes.
- **Find design-related courses**: Use **"Design"** in course names.
- **Exclude exams**: Use **"Lecture"** as a filter.
- **(Upcoming Feature) Filter by description**: Search for courses with relevant topics.

## Deployment
Sisukas is live at: [Sisukas](https://sisukas.fly.dev/)

## Running Locally
To test the application locally, use a simple HTTP server:

```sh
python -m http.server 8000
```

Then, open `http://localhost:8000` in your browser.

## To-Do List
- [ ] Improve responsive design for better mobile support.
- [ ] Refactor file structure for better maintainability.
- [ ] Implement filtering based on course descriptions.
- [ ] Label periods automatically based on course dates.
- [ ] Add predefined filters like "Starts in the future", "DSD curriculum", "CS minor", "Finnish language course".
- [ ] Add user management features.
- [ ] Support importing courses from a long string or fuzzy copied text.
- [ ] Generate an automatic timeline based on course schedules.
- [ ] Integrate a study calendar feature.
- [ ] Improve accessibility for better usability.

## Contribution
Contributions are welcome! If you'd like to improve the project:
1. Fork the repository.
2. Make your changes.
3. Submit a pull request.

A ⭐ on the repository is always appreciated!

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
