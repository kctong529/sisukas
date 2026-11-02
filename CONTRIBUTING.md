# Contributing to Sisukas

Thank you for your interest in contributing to Sisukas!

Sisukas is a course discovery and planning platform for Aalto University students. Contributions are welcome, including bug fixes, new features, tests, documentation, and design improvements.

Before contributing, please familiarize yourself with the current state of the project, its development priorities, and existing conventions.

## 1. Understand the project

Start with the following resources:

- **[Project Board](https://github.com/users/kctong529/projects/1)** — Current priorities, ongoing development, and planned tasks.
- **[GitHub Issues](https://github.com/kctong529/sisukas/issues)** — Requirements, implementation tasks, and known problems.
- **[Documentation](https://docs.sisukas.eu/)** — System architecture, concepts, and developer guides.
- **[Discussions](https://github.com/kctong529/sisukas/discussions)** — Questions, ideas, and broader design discussions.

### Finding something to work on

The **project board is the primary reference for the current development state**. Before choosing a task, review the board to understand what has been completed, what is actively being developed, and what remains in the backlog.

For an existing task:

1. Find the corresponding issue through the project board.
2. Read its description, checklist, comments, and related issues.
3. Check its priority, status, dependencies, and whether someone is already working on it.
4. Coordinate through the issue before starting substantial implementation.

For a new idea, search existing issues and discussions to avoid duplicate proposals. Open an issue or discussion to establish its scope before beginning implementation.

Please avoid large, uncoordinated changes that do not align with the current development priorities.

## 2. Development setup

Follow the [Running Sisukas Locally](https://docs.sisukas.eu/dev-guide/running-locally/) guide for environment setup and instructions for running the services.

Additional references include:

- [System Overview](https://docs.sisukas.eu/system-overview/) — Architecture and service responsibilities.
- [Developer Guide](https://docs.sisukas.eu/dev-guide/) — Implementation details and development workflows.
- [Course Data Architecture](https://docs.sisukas.eu/dev-guide/data-architecture/) — Dataset ownership, publication, and runtime resolution.
- [Data Pipeline](https://docs.sisukas.eu/dev-guide/data-pipeline/) — Course ingestion, reconciliation, and publication.
- [Frontend State Management](https://docs.sisukas.eu/dev-guide/stores/) — State management conventions.
- [Under Development](https://docs.sisukas.eu/under-dev/) — Ongoing designs and proposed functionality.

Not every contribution requires running the full stack. Consult the relevant documentation to determine which components and services are necessary.

## 3. Branching and pull requests

Sisukas maintains two long-lived branches:

| Branch | Purpose |
| --- | --- |
| `main` | Stable production branch. |
| `dev` | Active development and integration branch. |

**All regular contributions must target `dev`, not `main`.** Changes are integrated into `main` by maintainers when they are ready for production.

### Creating a branch

Create a feature branch from the latest `dev`:

```bash
git fetch origin
git switch dev
git pull --ff-only origin dev
git switch -c feat/short-description
```

Use descriptive branch names with prefixes such as `feat/`, `fix/`, `docs/`, `test/`, or `refactor/`.

### Pull requests and merge strategy

Sisukas follows two distinct merge policies:

| Pull request | Merge strategy |
| --- | --- |
| **Feature branch → `dev`** | **Squash and merge** |
| **`dev` → `main`** | **Create a merge commit** |

**Feature branches → `dev`:** Use GitHub's **Squash and merge** option. Each completed contribution should become one coherent commit on `dev`, with a descriptive Conventional Commits message and a reference to the relevant issue.

**`dev` → `main`:** Use GitHub's **Create a merge commit** option. Do not squash or rebase release pull requests. Preserving commit ancestry ensures that previously integrated development commits are recognized in subsequent releases.

Contributors should not merge directly into `main` or rewrite the history of shared branches. Production hotfixes are exceptional cases coordinated by maintainers.

### Submitting a pull request

Before opening a pull request:

1. Confirm that the work aligns with the project board and relevant issue.
2. Keep the changes focused and consistent with existing conventions.
3. Run the relevant tests and checks.
4. Open the pull request against **`dev`**.
5. Reference the issue and summarize the implementation, design decisions, and verification performed.

Keep pull requests reasonably sized. Larger features should be divided into independently reviewable increments wherever practical.

## 4. Commit conventions

Commits must be **small, self-contained, and focused on a single logical change**. Each commit should be understandable and reviewable independently.

Follow these rules:

- **One concern per commit.** Do not combine unrelated features, fixes, refactoring, formatting, or documentation changes.
- **Maximum five changed files per commit.** Exceptions are allowed only when a coherent change genuinely requires more files, such as a coordinated interface update, migration, or generated-file update. Explain the exception in the pull request.
- **Minimal changes.** Avoid unrelated cleanup, speculative refactoring, and modifications outside the agreed issue scope.
- **Working states.** Each commit should ideally leave the affected code functional, with relevant tests passing.
- **Clear commit messages.** Follow the Conventional Commits style already used in the repository.

Examples:

```text
feat(calendar): add occurrence filtering
fix(data): handle missing course dates
test(frontend): cover academic year selection
docs: clarify local development setup
```

Develop incrementally and preserve meaningful development steps in your feature branch. Minor work-in-progress or fixup commits may be consolidated.

Feature branch pull requests are squash-merged into `dev`, as described above. The five-file guideline applies to individual development commits; an appropriately scoped feature PR may contain more than five files in total.

Avoid rewriting shared branch history. Any exceptional history rewriting must be coordinated with maintainers.

## 5. AI-assisted contributions

AI-assisted development is permitted, but contributors remain fully responsible for the code they submit.

Follow these expectations:

- **Understand your changes.** Review all AI-generated or AI-modified code before committing it. Do not submit code you cannot explain.
- **Maintain strict scope.** AI-assisted changes must follow the same issue scope, commit-size limits, and review standards as manually written code.
- **Work incrementally.** Avoid large, automatically generated implementations or broad repository-wide modifications without prior coordination.
- **Verify independently.** Run appropriate tests and inspect the resulting behavior rather than relying solely on an AI tool's assessment.
- **Preserve consistency.** Follow existing architecture, domain terminology, coding patterns, and documentation conventions.
- **Remain accountable.** Be prepared to explain implementation choices, assumptions, limitations, and potential consequences during review.

AI tools should support engineering work, not replace understanding, judgment, or code review. Maintainers may request smaller changes, additional explanation, or revisions when a contribution is difficult to review or insufficiently justified.

## 6. Testing and quality

Contributions should include appropriate verification for the affected functionality.

Depending on the change, this may include:

- Unit tests for domain logic, edge cases, and failure conditions.
- Integration tests for service boundaries and persistence.
- Acceptance tests for user-facing behavior.
- Static analysis, type checking, and production builds.
- Data validation for curriculum or course-ingestion changes.

Add or update tests when changing behavior. Consider boundary conditions and failure cases rather than testing only successful scenarios.

Run the relevant checks locally before opening a pull request. Consult the component-specific documentation and existing CI workflows for further guidance.

If some checks cannot be run, explain this in the pull request.

## 7. Documentation and design consistency

Sisukas uses domain models and explicit service boundaries to keep its planning logic maintainable.

Before introducing new models or changing existing behavior, review the relevant [concept documentation](https://docs.sisukas.eu/concepts/) and [developer guide](https://docs.sisukas.eu/dev-guide/).

Prefer extending established conventions over introducing parallel implementations. Changes to terminology, data contracts, architecture, or development workflows should be reflected in the corresponding documentation.

For unfinished features, consult the [Under Development](https://docs.sisukas.eu/under-dev/) section, recognizing that proposed designs may evolve.

Avoid unrelated documentation rewrites as part of otherwise focused implementation changes.

## 8. Communication and collaboration

Use GitHub issues to discuss implementation details, coordinate work, and report progress. Keep important decisions and findings visible so other contributors can understand the reasoning behind changes.

When contributing:

- Ask questions when requirements or existing behavior are unclear.
- Coordinate before modifying areas under active development.
- Keep issue discussions and pull request descriptions focused.
- Document important assumptions, limitations, and follow-up work.
- Update the relevant issue when implementation decisions or scope change significantly.

Contributions are welcome at different levels of experience. Clear communication, careful reasoning, and maintainable changes matter more than the size of a contribution.

## License

By contributing to Sisukas, you agree that your contributions will be distributed under the project's [MIT License](LICENSE).
