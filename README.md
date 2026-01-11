# Sisukas

[![CI Pipeline](https://github.com/kctong529/sisukas/actions/workflows/ci.yml/badge.svg)](https://github.com/kctong529/sisukas/actions/workflows/ci.yml)
[![PyPI](https://img.shields.io/pypi/v/sisu_wrapper?label=sisu-wrapper)](https://pypi.org/project/sisu-wrapper/)
[![Documentation](https://img.shields.io/badge/docs-sisukas.eu-blue)](https://docs.sisukas.eu/)

Sisukas is a course discovery and study planning tool for university students in the Finnish education system. It is developed as an independent side project and is actively evolving.

> [!NOTE]
> The project began as a lightweight, performance-focused alternative to the SISU course browser. Over time, it has grown into a broader exploration of how students actually browse, compare, and plan courses, especially when schedules do not fit together cleanly. Sisukas does not aim to replace SISU, but to complement it by focusing on clarity, speed, and decision-making support.

The live application is available at [https://sisukas.eu](https://sisukas.eu), with documentation hosted at [https://docs.sisukas.eu](https://docs.sisukas.eu).


## Motivation

SISU is the official system for course information and registration, but it often makes exploration and comparison unnecessarily difficult. Finding relevant courses typically involves navigating through multiple views, filtering options are limited, and important details are buried behind repeated clicks. Performance issues add further friction, especially when browsing large course catalogs.

More importantly, SISU offers very limited support for *planning*. Courses are presented mostly in isolation, and scheduling conflicts are treated as something to avoid entirely, rather than something students routinely work around.

> [!IMPORTANT]
> In practice, students frequently deal with overlapping lectures, exercises, or exams. They make trade-offs, skip sessions, watch recordings later, or prioritize one course over another. Sisukas is built around this reality instead of ignoring it.

## Current State of the Project

Sisukas focuses on two core areas: fast, structured course discovery and early-stage planning.

**Discovery** is powered by a browser-cached course database. Once loaded, searching and filtering thousands of courses happens instantly without network requests. The filtering system is intentionally expressive. Users can combine multiple conditions, use Boolean logic, constrain time ranges, and build complex queries. These filters can be saved and shared via short URLs.

**Early planning** features are just beginning to take shape. Authenticated users can bookmark courses as favorites, forming the foundation for semester planning features currently under development. The application also tracks course instances (specific offerings in a given semester), which is essential for meaningful planning.

> [!TIP]
> From a technical perspective, Sisukas is built with production-style practices. It uses CI/CD pipelines, maintains separate development and production environments, and is deployed across Fly.io, Google Cloud Run, and Supabase. While this infrastructure exceeds what a hobby project strictly needs, it reflects the goal of experimenting with real-world system design.

## Direction and Ongoing Work

Sisukas is gradually moving beyond course browsing toward semester planning and conflict-aware scheduling. This transition is deliberate and incremental.

### The Core Insight

> [!IMPORTANT]
> Most scheduling tools treat overlapping courses as an error to prevent. Sisukas takes the opposite view: overlaps are inevitable and normal. The goal is not to eliminate them, but to surface them clearly so students can make explicit trade-offs.

This starts with a key distinction: an abstract course ("MS-A0111") is useful for discovery, but real planning requires concrete instances ("MS-A0111 2025 Autumn"). Once students have instances, they need to:

1. Group them into a Plan for a semester
2. Explore combinations of study groups (lectures, exercises, exams) to find good pairings
3. See where conflicts arise, and choose which events to prioritize

### What's Being Built (Phase 1)

**Plans** are collections of course instances a student is considering together. Instead of comparing courses one by one, students can say "I'm thinking about these 4 courses in Spring 2025" and work from there.

**SchedulePairs** are optimized combinations of study groups for 2+ instances in a Plan. When a student picks two courses and wants to know "what's the best way to combine study groups?", the system generates all valid pairings, scores them by level of conflicts, and shows the ranked options. A good pairing might have zero conflicts; a weaker one might have 1 hour of overlap on Tuesday mornings. The student chooses based on what works for them.

> [!NOTE]
> The *LEGO View* is where this happens: students select 2+ instances from their Plan, see ranked SchedulePairs, and lock in the best option.

### What's Coming Later (Phase 2)

Once a student commits to a pairing, **Decision Slots** activate. These are time intervals where 2+ events overlap, requiring an explicit choice about which to attend. Rather than hiding complexity, the system makes every trade-off visible:

- One event is marked primary (you attend)
- Others are marked secondary (you skip, watch later, or negotiate)
- The system remembers what you sacrificed, feeding into workload metrics and reflection tools

> [!IMPORTANT]
> The *Schedule View* will then answer: "What am I actually doing?" not just "What exists on my calendar?"

### Current Implementation Status

- Plans: Partial backend, UI coming soon
- SchedulePairs: Service prototype in progress
- Decision Slots: Designed but not yet implemented
- Full calendar view: Planned but not started

> [!TIP]
> These are being built iteratively. Some features exist as prototypes or design sketches; others are fully functional. The project intentionally avoids committing to a rigid roadmap upfront, preferring small testable steps over big promises.

## Technical Overview

Sisukas is structured as a set of loosely coupled components rather than a single monolithic application. The frontend is intentionally lightweight and avoids heavy frameworks, prioritizing fast load times and responsive interaction. It operates as a local-first application; by caching course data in the browser, it enables instant searching and remains usable even with limited or no network connectivity.

Backend functionality is split into focused services. The main API handles authentication and communication with the PostgreSQL database for user-specific data. The Filters API handles persistence and sharing of filter configurations, while the sisu-wrapper module is being developed to aggregate and normalize SISU teaching session data.

Course data is fetched from the Aalto Open API and updated automatically via GitHub Actions. The client relies on aggressive caching and conditional requests to stay fast while remaining reasonably up to date.

The project is containerized and deployed using modern cloud tooling. CI/CD pipelines ensure changes are tested and deployed consistently, and the overall setup emphasizes maintainability over minimalism.

## Running Locally

> [!NOTE]
> Local setup has been tested on macOS and Linux. Windows users may need to rely on WSL (Windows Subsystem for Linux).

### Prerequisites

Install [uv](https://docs.astral.sh/uv/) (fast Python package manager) and [Node.js](https://nodejs.org/) (v18+):
```sh
uv --version && node --version
```

### Quick Start
```sh
git clone https://github.com/kctong529/sisukas.git
cd sisukas
make setup        # Creates venvs, installs dependencies for all components
```

The project uses **uv** for faster, more reliable Python dependency management, and a **Makefile** for streamlined setup across frontend and backend services.

**Run the frontend:**
```sh
cd course-browser && npm run dev
# Opens at http://localhost:5173
```

**Run backend services (optional):**
```sh
# Filters API at http://127.0.0.1:8000
cd filters-api && uv run fastapi dev main.py

# Sisu Wrapper at http://127.0.0.1:8001
cd sisu-wrapper && uv run fastapi dev api/main.py --port 8001
```

> [!NOTE]
> The frontend runs independently—backend services are only needed for filter sharing or SISU integration features. See the [Filters API documentation](https://filters-api.sisukas.eu/docs) for production endpoints.

Run `make help` to see all available commands.

> [!NOTE]
> If you're interested in building the app for production, you can run `npm run build`. This will bundle the project for production and create the necessary static files in the `/dist` folder. You can serve the files from the `/dist` directory using any HTTP server of your choice (e.g. `python -m http.server`).

> [!TIP]
> `courses.json` is blocked when accessed directly via `file://` in the browser (due to browser security restrictions). Using the local server ensures proper loading of `courses.json`.

## Contributing

Sisukas is open to contributions, ideas, and discussion. Because the project is still evolving, there are no rigid contribution rules or fixed architecture constraints. [Discussions](https://github.com/kctong529/sisukas/discussions), [issue reports](https://github.com/kctong529/sisukas/issues), [project backlog](https://github.com/users/kctong529/projects/1), documentation improvements, and small code contributions are all welcome.

> [!NOTE]
> Feedback on the mental model, terminology, planning concepts, and design decisions is particularly valuable at this stage. The system is still evolving, and shaping how students think about schedules is as important as the implementation itself.

## Project Philosophy

Sisukas is built around a few guiding principles. Scheduling conflicts are treated as a normal part of academic life rather than an error state. The system aims to surface trade-offs clearly instead of hiding them behind rigid constraints. Optimization is used to assist users, not to replace human judgment. Above all, the project values incremental progress and conceptual clarity over premature completeness.

## License

This project is released under the MIT License. See the [LICENSE](LICENSE) file for details.
