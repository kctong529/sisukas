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
- **(Upcoming Feature) Filter by description**: Search for courses with relevant topics.

## Technical Stack
- **Vanilla JavaScript**: Simple, lightweight, and runs efficiently in the browser.
- **Static JSON Database**: Course data is loaded once at startup, ensuring quick performance.

## Deployment
Sisukas is live at: [Sisukas](https://sisukas.fly.dev/)

## Running Locally
To test the application locally, use a simple HTTP server:

```sh
python -m http.server 8000
```

Then, open `http://localhost:8000` in your browser.

## To-Do List
- [ ] Enhance responsive design for a smoother mobile experience.  
- [ ] Refactor the file structure to improve maintainability.  
- [ ] Enable filtering by course descriptions.  
- [ ] Automatically label periods based on course dates.  
- [ ] Add predefined filters such as "Starts in the future," "DSD curriculum," "CS minor," and "Finnish language course."  
- [ ] Implement support for nested sorting criteria.  
- [ ] Introduce user management features.  
- [ ] Allow users to pin courses to keep them at the top.  
- [ ] Enable saving and loading of the current view.  
- [ ] Support importing courses from a long string or fuzzy copied text.  
- [ ] Automatically generate a timeline based on course schedules.  
- [ ] Integrate a study calendar for better planning.  
- [ ] Improve accessibility for a more inclusive user experience.  

## Contribution
Contributions are welcome! If you'd like to improve the project:
1. Fork the repository.
2. Make your changes.
3. Submit a pull request.

A ⭐ on the repository is always appreciated!

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
