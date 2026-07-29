# Feature 002 - Project Creation

## Summary

Implement project creation and discovery within Minna using a single Add Project workflow.

This feature establishes Minna's project persistence model by scaffolding project configuration, maintaining the global project registry, and opening projects for use. It intentionally does not introduce feature management, orchestration, or AI functionality.

---

## Background

Projects are the top-level container for all work performed in Minna.

Every work item, journal entry, session, and future orchestration activity belongs to a project.

Projects are represented by an existing folder on disk. Minna determines whether that folder is already a project or should be initialized as one.

---

## Objectives

- Allow users to add projects through a single workflow.
- Detect existing Minna projects.
- Scaffold new Minna projects.
- Maintain the global project registry.
- Open projects after successful validation or initialization.
- Establish the persistence foundation for future features.

---

## Scope

### Included

- Add Project workflow
- Native OS folder picker
- Project detection
- Project scaffolding
- Project validation
- Project registry management
- Recent Projects
- Project switching

### Excluded

- Project rename
- Project settings
- Feature creation
- Feature management
- Agent execution
- AI integration
- Git integration
- Cloud synchronization
- Multi-user support
- Project import/export

---

## Functional Requirements

### Add Project

Projects are added through a single workflow.

1. The user selects **Add Project**.
2. Minna opens the native operating system folder picker.
3. The user selects a folder.
4. Minna checks the presence of the `.minna/` directory and `.minna/config.yaml`.

If the `.minna/` directory does not exist:

- Create the `.minna` directory.
- Scaffold `.minna/config.yaml`.
- Initialize `.minna/minna.db` event database.
- Register the project in the global project registry.
- Open the project.

If the `.minna/` directory exists and `.minna/config.yaml` exists:

- Validate the project configuration.
- Update the project's `last_opened_at` value in the global project registry.
- Open the project.

If the `.minna/` directory exists but `.minna/config.yaml` is missing or invalid:

- Reject the project and abort registry updates.
- Display a validation failure modal.

---

### Project Naming

The project name is derived from the selected folder name.

Users are not prompted to enter a project name during this workflow.

Project renaming is a future feature and is explicitly out of scope.

---

### Project Configuration

Each project contains a project-scoped configuration file located at:

```text
.minna/config.yaml
```

Initial contents:

```yaml
description: null
created_at: <ISO 8601 timestamp>
version: 1
```

`created_at` is written only when the project is first initialized.

`description` is initially `null` and will be editable in a future Project Settings feature.

This configuration file is intended to be project-local and suitable for version control.

---

### Global Project Registry

Minna maintains a global registry of known projects located at:

```text
~/.minna/projects.db
```

The registry is stored in a SQLite database to comply with core database-backed transactional requirements. It contains an append-only `events` journal and a `projects` projection table with columns: `id`, `name`, `path`, and `last_opened_at`.

A read-only JSON copy of the registry is exported at `~/.minna/projects.json` for external inspections.

The registry represents every project known to Minna on the current machine.

`last_opened_at` shall be updated every time a project is opened, regardless of whether the project already existed or was newly initialized.

---

### Project Validation

A valid Minna project is defined as a folder containing:

```text
.minna/config.yaml
```

If Minna encounters:

- a missing `config.yaml` inside an existing `.minna` directory,
- an invalid configuration file,
- or an unparseable configuration,

the project shall be rejected and a clear error message displayed.

Existing project data must never be overwritten or re-scaffolded automatically.

---

### Recent Projects

The Recent Projects list is derived directly from the global project registry.

Projects shall be displayed in descending order of `last_opened_at`.

No separate storage mechanism is required.

---

## Design Reference

The accompanying design handoff is the source of truth for:

- Layout
- Navigation
- Component styling
- Interaction behavior

Implementation should follow the approved design unless technical constraints require minor adjustments.

---

## References

This feature shall conform to the following project documents:

- `docs/minna-project-registry.md`

The project configuration file (`.minna/config.yaml`) and the global project database registry (`~/.minna/projects.db`) together define the persistence contract for this feature.

---

## Acceptance Criteria

- Users can add a project using the native operating system folder picker.
- Existing Minna projects are detected, validated, and opened successfully.
- New Minna projects are scaffolded successfully.
- `.minna/config.yaml` is created for newly initialized projects.
- Newly initialized projects are added to the global project registry.
- `last_opened_at` is updated every time a project is opened.
- Invalid project structures or configuration files are rejected with a clear error message.
- The Recent Projects list is populated directly from the global project registry and sorted by `last_opened_at`.
- The feature operates entirely offline.
- No AI services, Git integration, or remote backend services are required.

---

## Notes

This feature establishes Minna's project persistence model.

Subsequent features will build upon this foundation by introducing work items, journals, state management, session management, and orchestration while reusing the same project structure and registry.