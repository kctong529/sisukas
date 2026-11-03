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
Discover → Plan → Assemble → Calendar
```

This lifecycle is the conceptual backbone of the system.
Long-term context across past, current, and planned studies is provided separately by the Year Timeline.

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

- Plans group course instances (e.g. “CS-A1110 Autumn 2025”)
- Nothing is registered or committed
- Multiple plans are supported (“Option A”, “Option B”)

📘 Docs: [https://docs.sisukas.eu/concepts/plans/](https://docs.sisukas.eu/concepts/plans/)

**Status:** ✅ Mostly implemented

### Phase 2: Assembly (LEGO Blocks)

**Question:** *Given these LEGO blocks, what scheduling configurations could work?*

- Students select LEGO blocks as inputs to the assembler
- The assembler returns ordered assembly candidates; its algorithm and ranking criteria may evolve
- Candidates may contain unavoidable overlaps or differ in which courses they schedule

> [!IMPORTANT]
> Sisukas does not choose for the student. It makes trade-offs visible.

📘 Docs: [https://docs.sisukas.eu/concepts/assemblies/](https://docs.sisukas.eu/concepts/assemblies/)

**Status:** 🟡 Existing scheduling implementation; revised assembly model proposed

### Phase 3: Calendar (Attendance Decisions)

**Question:** *Which courses and teaching activities do I actually intend to attend?*

> [!TIP]
> Some overlaps are unavoidable. The calendar supports explicit attendance decisions rather than assuming a conflict-free timetable.

The **study calendar** is the student's editable working timetable. An assembly candidate may propose active courses and default study-group selections, but it does not dictate attendance.

- Generating candidates does not change the calendar
- Applying a candidate is an explicit action, with proposed changes previewed before confirmation
- Compatible attendance preferences and event overrides should be preserved when applying a candidate

📘 Docs: [https://docs.sisukas.eu/under-dev/study-calendar/](https://docs.sisukas.eu/under-dev/study-calendar/)

**Status:** 📋 Under development; assembly application is proposed

## Current Implementation Status

| Phase   | Concept        | Status       |
| ------- | -------------- | ------------ |
| Phase 0 | Filtering      | ✅ Live      |
| Phase 1 | Plans          | ✅ Live      |
| Phase 2 | Assemblies     | 🟡 Existing scheduler; new model proposed |
| Phase 3 | Study Calendar | 📋 Under development |

> [!NOTE]
> The project is developed iteratively. Conceptual clarity takes priority over shipping incomplete abstractions.

## Data Sources

Sisukas combines two Aalto data sources:

- **Aalto Open API**
  Static course metadata, updated daily. Powers discovery and filtering.

- **Aalto SISU API**
  Real-time study group and schedule data, accessed via the `sisu-wrapper` service.

These sources are intentionally kept separate.

📘 Docs: [https://docs.sisukas.eu/dev-guide/data-pipeline/](https://docs.sisukas.eu/dev-guide/data-pipeline/)

## Technical Overview

Sisukas is built as a set of loosely coupled services:

- **Frontend:** Svelte, local-first, aggressively cached
- **Backend:** Authentication and user-scoped persistence
- **Filters API:** Shareable filter persistence (not user-bound)
- **SISU Wrapper:** Normalized access to study group data

The system prioritizes clarity and correctness over minimal setup.

## Running Locally

> [!IMPORTANT]
> Local development requires HTTPS on localhost and multiple services.
> This is intentional and documented.

The repository includes a fully tested local development setup using:
- HTTPS via mkcert
- Dockerized Postgres
- Independent services for frontend, backend, SISU wrapper, and filters API

**Do not rely on this README for setup instructions.**

**📘 Authoritative Guide:** [https://docs.sisukas.eu/dev-guide/running-locally/](https://docs.sisukas.eu/dev-guide/running-locally/)

## Contributing

Sisukas is open to contributions, ideas, and discussion. There are no rigid contribution rules at this stage.
- Discussions: [https://github.com/kctong529/sisukas/discussions](https://github.com/kctong529/sisukas/discussions)
- Issues: [https://github.com/kctong529/sisukas/issues](https://github.com/kctong529/sisukas/issues)
- Project board: [https://github.com/users/kctong529/projects/1](https://github.com/users/kctong529/projects/1)

> [!NOTE]
> Feedback on mental models, terminology, and planning concepts is especially valuable. The system is still evolving.

## Project Philosophy

- Conflicts are normal, not errors
- Optimization should assist, not replace judgment
- Trade-offs should be explicit
- Planning is a process, not a checkbox

Sisukas is as much about **how students think about schedules** as it is about software.

## License

This project is released under the MIT License. See the [LICENSE](LICENSE) file for details.
