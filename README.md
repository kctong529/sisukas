# Sisukas

[![CI Pipeline](https://github.com/kctong529/sisukas/actions/workflows/ci.yml/badge.svg)](https://github.com/kctong529/sisukas/actions/workflows/ci.yml)
[![PyPI](https://img.shields.io/pypi/v/sisu_wrapper?label=sisu-wrapper)](https://pypi.org/project/sisu-wrapper/)
[![Documentation](https://img.shields.io/badge/docs-sisukas.eu-blue)](https://docs.sisukas.eu/)

Sisukas is a course discovery and semester planning tool for university students in the Finnish education system. It is developed as an independent side project and is actively evolving.

> [!NOTE]
> The project began as a lightweight, performance-focused alternative to the SISU course browser. Over time, it has grown into a broader exploration of how students actually browse, compare, and plan courses—especially when schedules do not fit together cleanly.
> Sisukas does not aim to replace SISU, but to complement it by focusing on clarity, speed, and conscious decision-making.

The live application is available at **[https://sisukas.eu](https://sisukas.eu)**, with documentation at **[https://docs.sisukas.eu](https://docs.sisukas.eu)**.

## Motivation

SISU is the official system for course information and registration, and it fulfills that role well. However, it is not designed to support planning.

Planning a semester is exploratory and iterative. Students compare alternatives, test combinations, notice conflicts, and make trade-offs. SISU largely assumes this work happens elsewhere — in spreadsheets, calendars, or memory.

> [!IMPORTANT]
> Scheduling conflicts are not an error state. They are a normal part of academic life.

Students routinely skip sessions, watch recordings, prioritize one course over another, or accept temporary overload. Sisukas is built around this reality instead of ignoring it.

## The Planning Lifecycle

Sisukas is structured around a multi-phase planning model.
Each phase answers a different question students face when assembling a semester.

```
Discover → Plan → Optimize → Decide
```

This lifecycle is the conceptual backbone of the system.

### Phase 0: Discovery (Filtering)

**Question:** *What courses exist that might fit my goals and constraints?*

Discovery is about **possibility**, not commitment.

- Fast, browser-cached course database
- Expressive filtering (periods, enrollment, majors, format)
- Boolean logic and composable constraints
- Shareable, reusable filter URLs

> [!TIP]
> At this stage, courses are still abstract. You are not yet considering concrete schedules.

📘 Docs: [https://docs.sisukas.eu/concepts/filtering/](https://docs.sisukas.eu/concepts/filtering/)

**Status:** ✅ Fully implemented

### Phase 1: Planning Workspace (Plans)

**Question:** *Which concrete course instances am I considering together this semester?*

A **Plan** is a workspace, not a decision.

- Plans group **course instances** (e.g. “CS-A1110 Autumn 2025”)
- Nothing is registered or committed
- Multiple plans are supported (“Option A”, “Option B”)

> [!NOTE]
> Plans allow students to think in coherent sets, rather than comparing courses one by one.

📘 Docs: [https://docs.sisukas.eu/concepts/plans/](https://docs.sisukas.eu/concepts/plans/)

**Status:** 🟡 Backend implemented, UI in progress

### Phase 2: Optimization (Schedule Pairs)

**Question:** *Given these courses, what are the best ways to combine their study groups?*

This is where Sisukas fundamentally differs from SISU.

- Study groups are partitioned into **blocks** (user-defined, with sensible defaults)
- Each Schedule Pair selects **one study group per block, per course**
- All valid combinations are generated
- Combinations are ranked by how well they fit (level of conflicts)

> [!IMPORTANT]
> Each Schedule Pair represents a complete, concrete timetable option.

Importantly:

- Sisukas does **not** choose for the student
- It presents a ranked menu so trade-offs are visible and explicit

📘 Docs: [https://docs.sisukas.eu/concepts/schedule-pairs/](https://docs.sisukas.eu/concepts/schedule-pairs/)

**Status:** 🟡 Algorithm designed, service prototype in progress

### Phase 3: Resolution (Decision Slots)

**Question:** *Where conflicts remain, what am I actually going to do?*

> [!TIP]
> Some overlaps are unavoidable. Sisukas treats them as conscious decisions, not noise.

A **Decision Slot** is a time interval where selected study groups overlap.
For each slot, the student explicitly marks:

- **Primary** event (attending)
- **Secondary** event(s) (recording, self-study, negotiation, etc)

This produces:

- a calendar that reflects the *real* plan
- a record of trade-offs made
- data for later reflection and workload analysis

📘 Docs: [https://docs.sisukas.eu/concepts/decision-slots/](https://docs.sisukas.eu/concepts/decision-slots/)

**Status:** 📋 Designed, not yet implemented

## Current Implementation Status

| Phase   | Concept        | Status       |
| ------- | -------------- | ------------ |
| Phase 0 | Filtering      | ✅ Live       |
| Phase 1 | Plans          | 🟡 Partial   |
| Phase 2 | Schedule Pairs | 🟡 Prototype |
| Phase 3 | Decision Slots | 📋 Designed  |

> [!NOTE]
> The project is developed iteratively. Conceptual clarity takes priority over shipping incomplete abstractions.

## Data Sources

Sisukas combines two Aalto data sources:

- **Aalto Open API**
  Static course metadata, updated daily. Powers discovery and filtering.

- **Aalto SISU API**
  Real-time study group and schedule data, accessed via the `sisu-wrapper` service.

These sources are intentionally kept separate due to different update frequencies and responsibilities.

📘 Docs: [https://docs.sisukas.eu/data-pipeline/](https://docs.sisukas.eu/data-pipeline/)

## Technical Overview

Sisukas is built as a set of loosely coupled services:

- **Frontend:** Svelte, local-first, aggressively cached
- **Backend:** User data, plans, authentication
- **Filters API:** Persistence and sharing of filters
- **SISU Wrapper:** Normalized access to study group data

The system prioritizes responsiveness, maintainability, and clear boundaries over minimal setup.

## Running Locally

> [!NOTE]
> Local setup is tested on macOS and Linux. Windows users should use WSL.

### Prerequisites

- [uv](https://docs.astral.sh/uv/) (Python package manager)
- [Node.js](https://nodejs.org/) v18+

```sh
uv --version && node --version
```

### Quick Start

```sh
git clone https://github.com/kctong529/sisukas.git
cd sisukas
make setup        # Creates venvs, installs dependencies for all components
```

Run the frontend:
```sh
cd frontend/course-browser && npm run dev
# Opens at http://localhost:5173
```

Backend services are optional for discovery, but required for authenticated features.

📘 Full setup: [https://docs.sisukas.eu/getting-started/](https://docs.sisukas.eu/getting-started/)

## Contributing

Sisukas is open to contributions, ideas, and discussion. Because the project is still evolving, there are no rigid contribution rules or fixed architecture constraints. [Discussions](https://github.com/kctong529/sisukas/discussions), [issue reports](https://github.com/kctong529/sisukas/issues), [project backlog](https://github.com/users/kctong529/projects/1), documentation improvements, and small code contributions are all welcome.

> [!NOTE]
> Feedback on the mental model, terminology, planning concepts, and design decisions is particularly valuable at this stage. The system is still evolving, and shaping how students think about schedules is as important as the implementation itself.

## Project Philosophy

- Conflicts are normal, not errors
- Optimization should assist, not replace judgment
- Trade-offs should be explicit
- Planning is a process, not a checkbox

Sisukas is as much about **how students think about schedules** as it is about software.

## License

This project is released under the MIT License. See the [LICENSE](LICENSE) file for details.
