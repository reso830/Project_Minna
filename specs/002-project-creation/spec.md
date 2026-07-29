# Feature Specification: Project Creation

**Feature Branch**: `002-project-creation`
**Created**: 2026-07-29
**Status**: Draft
**Input**: [002-project-creation.md](file:///D:/Alvin/_CodeProjects/Project_Minna/docs/features/v1.0.0-minna-foundations/002-project-creation.md)

## Clarifications

### Session 2026-07-29

- **Q**: How should the "native operating system folder picker" be implemented in the Next.js web application?
  → **A**: Use a Next.js server-side API endpoint that invokes a native OS directory selector dialog (e.g., via a Node library or backend script) to retrieve the absolute path.
- **Q**: How should the project `id` in the global registry be generated, and how should collisions (duplicate folder names) be handled?
  → **A**: Slugify the folder name for ID. On a slug collision where the path differs from any existing entry, append a sequential numeric suffix starting at `-2` (e.g. `my-project-2`). If the path already matches an existing entry, that is not a collision, it is the standard re-open flow (update `last_opened_at` and open it).
- **Q**: Where and how should project validation errors (e.g., invalid `config.yaml`) be displayed to the user?
  → **A**: A dedicated error modal, because the failure is the direct outcome of a deliberate user action with no partial state to preserve, and because the brief's "never auto-repair invalid project data" rule means the user needs a clear stop-and-decide moment, not a passing notification.
- **Q**: Should the CLI commands ([cli.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/cli.ts)) be updated to support or validate against the new global registry (`~/.minna/projects.json`) in this feature scope?
  → **A**: Yes, scoped narrowly. The CLI should register/update the current project's registry entry (`id`/`name`/`path`/`last_opened_at`) on operation, reusing the same registry-write logic the app uses, without needing the picker or modal UX that's specific to the interactive Add Project flow.
- **Q**: How should the new `~/.minna/projects.json` (now `projects.db`) global registry interact with the existing `projects.yaml` and `minna.project.yaml` configurations?
  → **A**: `projects.yaml` is deleted. `minna.project.yaml` is functionally the legacy per-project config. It must be migrated/renamed to the new `.minna/config.yaml` convention. Registry operations should not coexist with or build upon legacy configs.

## Problem Statement

Minna needs a unified mechanism to define, discover, and switch between project scopes. In compliance with **Constitution Principle III (State is the source of truth)** and **Principle VI (Local-First, Inspectable State)**, all project-tracking state must reside within a database-backed transaction layer, avoiding raw hand-editable flat files as the primary source of truth.

This feature replaces legacy configurations with:
1. A central SQLite database (`~/.minna/projects.db`) tracking project registration events and projections.
2. Local project databases (`.minna/minna.db`) storing localized project metadata and event logs. A local `.minna/config.yaml` is used strictly for static, declarative configuration options (like default branch or descriptions) meant for version control.
3. An interactive GUI "Add Project" workflow using a native directory selector.

## Scope

### In scope

- **"Add Project" Dialog Trigger**:
  - Integrate a click handler on the Add Project "+" icon button in the [Sidebar.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/Sidebar.tsx) header.
- **Server-Side Folder Picker API**:
  - Implement a Next.js server-side API endpoint (`/api/projects/pick`) that spawns a native directory selection dialog on the host OS to return the chosen absolute path.
- **Project Detection, Scaffolding, and Validation**:
  - **Check configuration**: If the directory has NO `.minna` folder, scaffold it by creating `.minna/`, writing `.minna/config.yaml`, and initializing the local project event database `.minna/minna.db` using the existing schemas in [db.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/db.ts).
  - **Lazy Database Initialization**: If the `.minna/config.yaml` is present but `.minna/minna.db` is missing, Minna lazily initializes the database on project open.
  - **Rejection**: If a `.minna` directory ALREADY exists but `config.yaml` is missing or invalid, reject it immediately (do not overwrite, auto-repair, or scaffold).
  - **Dedicated Error Modal**: Present any validation errors in a high-priority blocking modal dialog in the UI.
- **SQLite Global Project Registry**:
  - Store project registration events in a global SQLite database at `~/.minna/projects.db` (`C:/Users/acres/.minna/projects.db` on Windows) inside an append-only `events` journal table.
  - Maintain a `projects` projection table (columns: `id`, `name`, `path`, `last_opened_at`) updated in the same transaction as the event write.
  - Export a read-only projection copy to `~/.minna/projects.json` for external inspections (never read by the application as the source of truth).
  - **Naming**: The project `name` field preserves the exact directory name casing (e.g. `Project_Celia`). The project `id` is a slugified, lowercased version of the name.
  - **Collision Handling**: Resolve ID collisions by appending sequential suffixes (`-2`, `-3`, etc.) if distinct folder paths produce the same slug.
  - **Switching**: Support switching projects via endpoint `POST /api/projects/open` updating the `last_opened_at` timestamp.
- **Sidebar Project Listing**:
  - Fetch projects directly from the global registry instead of deriving them from active work items.
  - Support projects with zero features.
  - Detect and display a muted "unavailable" state for projects whose paths no longer resolve on disk.
- **Narrow CLI Registry Integration**:
  - Update [cli.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/cli.ts) and project resolution utilities so that CLI operations register/update the current project context's registry entry in `~/.minna/projects.db` using database transactions.
  - **Shipped Preservation**: The CLI continues to treat `--project <key>` verbatim as a free-text label for project scoping without validation blockages, synchronizing the path if known but never throwing `Unknown project: <key>` errors. Remove dead code referencing `projects.yaml`.

### Non-goals

- **Project Renaming or Settings**: Project descriptions and names remain read-only in this phase.
- **Auto-repair of Corrupt Projects**: Under no circumstances should the app attempt to recreate or repair a corrupted `.minna/config.yaml` automatically.
- **Git or Cloud Synchronization**: Projects are tracked purely on the local machine's disk and home directory database.
- **Authentication / Multi-user Support**: The application remains a local, single-operator environment.
- **Central Coexistence with `projects.yaml`**: The CLI's legacy central configuration is out of scope and should be treated as deleted/deprecated.

## User Behavior

1. **Adding a New Project**:
   - The user clicks the "+" icon next to the "Projects" heading in the left sidebar.
   - A native OS folder picker dialog opens.
   - The user navigates to and selects a directory.
   - **Case A (New Project)**: The folder does not contain a `.minna` folder. Minna initializes the project by creating `.minna/`, `.minna/config.yaml`, and `.minna/minna.db`. The project is registered and opened.
   - **Case B (Existing Project)**: The folder contains a valid `.minna/config.yaml` and `.minna/minna.db` (or `.minna/minna.db` is missing and is lazily initialized on open). Minna registers the project (if not already listed) and opens it.
   - **Case C (Invalid Project)**: The folder contains a `.minna` folder but lacks a `config.yaml` or has a corrupted configuration. A dedicated error modal displays the validation error. The folder remains untouched.
2. **Switching Projects**:
   - The user clicks an inactive project name in the left sidebar list.
   - The project context is updated, moving it to the top of the sidebar list as its `last_opened_at` timestamp is updated in `~/.minna/projects.db`.
3. **CLI Operations**:
   - The developer runs a command (e.g. `npm run cli status`) from inside a project directory.
   - The CLI detects the local project context, looks up or adds the project in `~/.minna/projects.db`, and updates its `last_opened_at` timestamp.

## Visual Design Reference

The following visual mockups specify the design coverage for components not covered by the original design zip package:

### 1. Rejection Error Modal
Displays validation failures when adding an invalid project directory.

![Error Modal Mockup](file:///D:/Alvin/_CodeProjects/Project_Minna/specs/002-project-creation/design/error_modal_mockup.jpg)

### 2. Sidebar Project States
Displays expanded project rows, empty project rows (zero features showing "No features found" nested indent), and muted/grayed-out "unavailable" projects.

![Sidebar Project States Mockup](file:///D:/Alvin/_CodeProjects/Project_Minna/specs/002-project-creation/design/sidebar_project_states_mockup.jpg)

> [!NOTE]
> The sidebar mockup is an illustrative visual reference meant solely to specify the layout behavior and style of the three project row states (active/highlighted, empty/no-features, and muted/unavailable). The target implementation must preserve Minna's actual brand logo, actual navigation links, chevrons, '+' affordances, and the Agent Usage widget as defined in [Sidebar.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/Sidebar.tsx). Do not implement the placeholder navigation elements shown in the mockup.

## Acceptance Criteria

### User Story 1 - Native OS Folder Pick & Scaffolding (Priority: P1)
As an operator, I want to add a directory using a native OS folder picker so that Minna can automatically initialize it as a new project if it isn't one already.
* **Why this priority**: Essential entry point for all project management.
* **Independent Test**: Run the Next.js app, click the Add Project button in the sidebar, choose a clean test directory in the OS picker, and verify that `.minna/config.yaml` and `.minna/minna.db` are created, the project is registered in the database `~/.minna/projects.db`, and the project appears at the top of the sidebar.
* **Acceptance Scenarios**:
  1. **Given** a directory `/path/to/my-new-project` has no `.minna` folder, **When** the user selects it via the OS folder picker, **Then** Minna scaffolds `.minna/config.yaml` and initializes `.minna/minna.db`, registers the project with ID `my-new-project` and name `my-new-project` (preserving casing), and opens the project scope.

### User Story 2 - Import and Validate Existing Projects (Priority: P1)
As an operator, I want to select an existing Minna project folder so that it is validated and opened without overwriting its configuration data.
* **Why this priority**: Supports project re-opening and import flows.
* **Independent Test**: Create a test folder with a pre-configured valid `.minna/config.yaml` (with or without a `.minna/minna.db` file). Use the Add Project button to pick this folder. Assert that the configuration remains unchanged, the database is lazily created if missing, and the project is opened successfully.
* **Acceptance Scenarios**:
  1. **Given** a directory `/path/to/old-project` with a valid `.minna/config.yaml` containing custom values, **When** the user selects it via the OS picker, **Then** Minna parses the configuration, registers it (if not already registered), updates the database's `last_opened_at` timestamp, and opens it without altering the local `config.yaml`.

### User Story 3 - Dedicated Error Modal for Invalid Projects (Priority: P1)
As an operator, I want to see a clear error dialog when selecting a corrupted project folder so that I know why it failed and my files are protected.
* **Why this priority**: Critical for data safety; prevents silent failures or accidental data overwriting.
* **Independent Test**: Select a directory containing a `.minna` folder with a missing or unparseable `config.yaml`. Assert that a dedicated error modal dialog appears in the UI displaying the specific validation failure, and the folder remains untouched.
* **Acceptance Scenarios**:
  1. **Given** a directory has a `.minna` folder but `config.yaml` is missing, **When** selected via the picker, **Then** a dedicated error modal displays "Project rejection: Missing config.yaml" and does not register the path.
  2. **Given** a directory has a `.minna/config.yaml` with malformed YAML syntax, **When** selected via the picker, **Then** a dedicated error modal displays the parsing error and aborts registration.

### User Story 4 - Project ID Collision Resolution (Priority: P2)
As a developer, I want duplicate project folder names in different paths to receive unique IDs in the global registry so that their work items do not conflict.
* **Why this priority**: Avoids identity collisions across the central registry.
* **Independent Test**: Register a project at `/path/A/my-project`. Then register a project at `/path/B/my-project`. Assert that both are stored in `~/.minna/projects.db` with IDs `my-project` and `my-project-2` respectively.
* **Acceptance Scenarios**:
  1. **Given** a project with path `/path/A/my-project` is registered as `my-project`, **When** the user adds `/path/B/my-project`, **Then** the database registry records the second project with ID `my-project-2` and name `my-project` (preserving casing).

### User Story 5 - CLI Registry Synchronization (Priority: P2)
As a CLI user, running Minna commands in a project directory should update its central registration status in the database.
* **Why this priority**: Keeps the list of recent projects consistent between the CLI and GUI tools.
* **Independent Test**: Execute a CLI command (e.g. `npm run cli status`) from a project directory, and check that `~/.minna/projects.db` has updated the project's `last_opened_at` timestamp to the current time.
* **Acceptance Scenarios**:
  1. **Given** a project `/path/to/my-project` exists in the global registry, **When** the developer runs a command in that project directory, **Then** the CLI updates the project's `last_opened_at` field in `~/.minna/projects.db`.

## Edge Cases

- **File System Permissions**: If the app lacks write permissions to `~/.minna/` or the chosen project directory, it should display a permission error modal and not corrupt any existing registry state.
- **Unavailable Projects**: If a registered project path no longer resolves on disk when the app loads, the sidebar displays it in a muted, disabled "unavailable" state and prevents clicking it.
- **Concurrent Writes (Locking)**: If both the CLI and Next.js app read/write `~/.minna/projects.db` concurrently, SQLite transaction locking (via WAL mode and BEGIN IMMEDIATE/EXCLUSIVE transactions) prevents lost updates and guarantees serialization.
- **Malformed Database File**: If `~/.minna/projects.db` becomes corrupted, it fails closed, raising a warning and refusing to overwrite existing user data before manual database inspection.

## Data Considerations

### Local Project Configuration (`.minna/config.yaml`)
Project-scoped configuration file residing inside the selected folder, strictly for static version-controlled variables.

**Fresh-scaffold shape** (Case A — no prior `.minna/` or `minna.project.yaml`), matching the brief exactly:
- `version`: Integer (currently `1`).
- `created_at`: ISO 8601 UTC timestamp of initialization.
- `description`: String or `null` (default: `null`).

```yaml
version: 1
created_at: "2026-07-29T09:32:40Z"
description: null
```

**Migrated-legacy shape** (only when a pre-existing `minna.project.yaml` is converted — see plan.md's "Configuration Migration & Backward Compatibility" section) additionally carries forward:
- `speckit_dir`: String specifying the specifications directory path relative to project root, read from the legacy file. (Present only on migrated projects; legacy default was `".specify"`.)
- `github`: String or `null` specifying the remote GitHub repository label, read from the legacy file. (Present only on migrated projects.)
- `default_branch`: String specifying default git branch, read from the legacy file. (Present only on migrated projects; legacy default was `"main"`.)

```yaml
version: 1
created_at: "2026-07-29T09:32:40Z"
description: null
speckit_dir: ".specify"
github: null
default_branch: "main"
```

These three fields are never written on a fresh scaffold — a brand-new project has no legacy values to preserve, and introducing Git-related defaults there would exceed this feature's scope (Git integration is explicitly excluded).

### Global Project Database (`~/.minna/projects.db`)
SQLite database containing:
- `events` Table:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `timestamp`: TEXT (ISO 8601 string)
  - `actor`: TEXT (`"human" | "system"`)
  - `type`: TEXT (`"project.registered" | "project.opened"`)
  - `payload`: TEXT (JSON string containing `{ id, name, path }`)
- `projects` Projection Table:
  - `id`: TEXT PRIMARY KEY
  - `name`: TEXT (exact folder name casing preserved)
  - `path`: TEXT (unique folder path)
  - `last_opened_at`: TEXT (ISO 8601 string)

## References

This feature shall conform to the following project documents:

- [docs/minna-project-registry.md](file:///D:/Alvin/_CodeProjects/Project_Minna/docs/minna-project-registry.md) (Registry v3)
- [docs/features/v1.0.0-minna-foundations/002-project-creation.md](file:///D:/Alvin/_CodeProjects/Project_Minna/docs/features/v1.0.0-minna-foundations/002-project-creation.md)
