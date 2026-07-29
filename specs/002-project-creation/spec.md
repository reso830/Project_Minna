# Feature Specification: Project Creation & Management

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

### Session 2026-07-29 (Update/Delete Amendment)

- **Q**: When relocating a project to a different directory, should Minna re-validate the new path's `.minna/config.yaml` (treating it like the 'Add' validation flow)?
  → **A**: Yes. Re-validate the configuration at the new path immediately. Relocating to a directory lacking a valid `.minna/config.yaml` is treated as a validation rejection (aborts relocation and displays the Error Modal). Relocating does not fall back to scaffolding new project files.
- **Q**: What happens if an operator relocates a project to a path that is already registered under another project?
  → **A**: Relocating to an already-registered path is rejected with a `400 Bad Request` validation error, showing the Error Modal: `"This directory is already registered as project '{existing_project_name}'."`
- **Q**: Does renaming a project touch anything besides the global registry's name field?
  → **A**: No. The rename is registry-only, modifying the display name in the global registry database and exporting `~/.minna/projects.json` / `~/.minna/registry-events.json`. The local `.minna/config.yaml` does not store a display name and is not edited.
- **Q**: What should be the exact event type names, payload shapes, and work item behaviors when a project is removed?
  → **A**: Introduce a small registry-scoped event log (e.g. `~/.minna/registry-events.json`) separate from any project-scoped event journals, recording `project.registered` (meaning added), `project.opened`, `project.renamed`, `project.relocated`, and `project.removed` events. The removal event payload shape is exactly `{ id: string }`. Work items, their local database journals, and all project files on disk are completely untouched.
- **Q**: If the health check on load (`GET /api/projects`) detects that `.minna/minna.db` is missing but the directory and `config.yaml` are valid, what happens?
  → **A**: The project is considered `available: true` because the database is lazily self-healing. When the user opens the project (`POST /api/projects/open` or CLI startup), the system calls `prepareProject()` to lazily initialize the database schema on disk. If the directory or `config.yaml` is missing or corrupted, the health check flags `available: false` and the project row is disabled.

## Problem Statement

Minna needs a unified mechanism to define, discover, and manage project scopes. In compliance with **Constitution Principle III (State is the source of truth)** and **Principle VI (Local-First, Inspectable State)**, all project-tracking state must reside within a database-backed transaction layer, avoiding raw hand-editable flat files as the primary source of truth.

This feature replaces legacy configurations and extends Feature 002 with:
1. A central SQLite database (`~/.minna/projects.db`) tracking project registration, opening, updates, and removal events.
2. Local project databases (`.minna/minna.db`) storing localized project metadata and event logs. A local `.minna/config.yaml` is used strictly for static, declarative configuration options.
3. Interactive GUI workflows to Add, Rename, Relocate, and Remove projects.
4. Ongoing project health checks to prevent dead links.

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
  - Store project events in a global SQLite database at `~/.minna/projects.db` (`C:/Users/acres/.minna/projects.db` on Windows) inside an append-only `events` journal table.
  - Maintain a `projects` projection table (columns: `id`, `name`, `path`, `last_opened_at`) updated in the same transaction as the event write.
  - Export a read-only projection copy to `~/.minna/projects.json` and registry events history to `~/.minna/registry-events.json` on commit.
  - **Naming**: The project `name` field preserves the exact directory name casing (e.g. `Project_Celia`) on initial addition, but can be updated via the UI. The project `id` is a slugified, lowercased version of the name.
  - **Collision Handling**: Resolve ID collisions by appending sequential suffixes (`-2`, `-3`, etc.) if distinct folder paths produce the same slug.
  - **Switching**: Support switching projects via endpoint `POST /api/projects/open` updating the `last_opened_at` timestamp.
- **Sidebar Project Listing & Actions Menu**:
  - Fetch projects directly from the global registry instead of deriving them from active work items.
  - Render an ellipsis popover menu for each project row on hover with options: **Edit Project** and **Remove Project**.
- **Edit Project Flow (Rename & Relocate)**:
  - Users can rename projects (modifying registered display name).
  - Users can relocate project paths via the native folder picker. Validation is run immediately at the target path, rejecting relocation if `.minna/config.yaml` is missing or invalid, or if the path is already registered under another project (Error Modal shown). Relocation does not scaffold.
- **Remove Project Flow**:
  - Deregister projects from the central registry (projection row deleted, removal event recorded). No project files on disk are affected.
- **Project Health Checks**:
  - Checks path existence and configuration validity on projects load. Invalid or missing configurations mark the project as unavailable.
- **Narrow CLI Registry Integration**:
  - Update [cli.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/cli.ts) and project resolution utilities so that CLI operations register/update the current project context's registry entry in `~/.minna/projects.db` using database transactions.

### Non-goals

- **Project Deletion on Disk**: Removing a project must never delete the project directory or its local database configurations on disk.
- **Auto-repair of Corrupt Projects**: Under no circumstances should the app attempt to recreate or repair a corrupted `.minna/config.yaml` automatically.
- **Git or Cloud Synchronization**: Projects are tracked purely on the local machine's disk.
- **Authentication / Multi-user Support**: The application remains a local, single-operator environment.

## User Behavior

1. **Adding a New Project**:
   - The user clicks the "+" icon next to the "Projects" heading in the left sidebar.
   - A native OS folder picker dialog opens.
   - **Case A (New Project)**: Folder lacks `.minna/`. Minna initializes configuration and database, registers the project, and opens it.
   - **Case B (Existing Project)**: Folder contains valid config. Minna registers the project (if not already listed) and opens it.
   - **Case C (Invalid Project)**: Folder contains `.minna/` but lacks a valid config. An error modal displays the validation failure, leaving the folder untouched.
2. **Switching Projects**:
   - The user clicks an inactive project name in the left sidebar list. The project context switches and updates the order.
3. **Editing/Relocating a Project**:
   - The user hovers over a project row and clicks the ellipsis menu (⋯).
   - User selects **Edit Project**. The Edit Project modal opens.
   - User can edit the name in the text input.
   - User can click **Select project directory** to trigger the OS folder picker, selecting a new path. If the new path lacks a valid `.minna/config.yaml`, or if it is already registered, the picker aborts and displays the Error Modal.
   - User clicks **Save** to persist the name/path changes, or **Cancel** (displaying a Discard changes confirmation if edits exist).
4. **Removing a Project**:
   - User clicks **Remove Project** (from the project menu or within the Edit modal).
   - A confirm modal is shown: `"Remove '{project name}'? This removes the project from Minna. Your project files on disk won't be affected."`
   - User clicks **Remove Project** to confirm, removing the row and updating the UI list.
5. **Ongoing Project Health Check**:
   - On load, Minna verifies each project folder's existence and configuration validity. Corrupted or missing configs render the project row disabled/muted in the sidebar.

## Visual Design Reference

The following visual mockups specify the design coverage for components not covered by the original design zip package:

### 1. Rejection Error Modal
Displays validation failures when adding or relocating to an invalid project directory.

![Error Modal Mockup](file:///D:/Alvin/_CodeProjects/Project_Minna/specs/002-project-creation/design/error_modal_mockup.jpg)

### 2. Sidebar Project States
Displays expanded project rows, empty project rows (zero features showing "No features found" nested indent), and muted/grayed-out "unavailable" projects.

![Sidebar Project States Mockup](file:///D:/Alvin/_CodeProjects/Project_Minna/specs/002-project-creation/design/sidebar_project_states_mockup.jpg)

> [!NOTE]
> The sidebar mockup and the project management prototype (`Minna Prototype.dc.html`) are illustrative visual references meant solely to specify layout behavior, modal configurations, and the styles of project management dialogs. The target implementation must preserve Minna's actual brand logo, actual navigation links, chevrons, '+' affordances, and the Agent Usage widget as defined in [Sidebar.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/Sidebar.tsx). Do not implement the placeholder navigation elements shown in the mockup.

> [!IMPORTANT]
> **Divergences from Handoff Prototype:**
> 1. **Native OS Picker:** The prototype implements a web-based file picker (`<input webkitdirectory>`) due to design tool limitations. The target implementation must instead invoke the native OS directory selector via `POST /api/projects/pick`.
> 2. **Deregistration Copy:** The prototype's confirmation modal displays text suggesting that journal entries will be deleted. The target implementation must instead use the corrected registry-only copy: `"This removes the project from Minna. Your project files on disk won't be affected."` to align with the registry-only removal constraint.

## Acceptance Criteria

### User Story 1 - Native OS Folder Pick & Scaffolding (Priority: P1)
As an operator, I want to add a directory using a native OS folder picker so that Minna can automatically initialize it as a new project if it isn't one already.
* **Why this priority**: Essential entry point for all project management.
* **Independent Test**: Run the Next.js app, click the Add Project button in the sidebar, choose a clean test directory in the OS picker, and verify that `.minna/config.yaml` and `.minna/minna.db` are created, the project is registered in the database `~/.minna/projects.db`, and the project appears at the top of the sidebar.

### User Story 2 - Import and Validate Existing Projects (Priority: P1)
As an operator, I want to select an existing Minna project folder so that it is validated and opened without overwriting its configuration data.
* **Why this priority**: Supports project re-opening and import flows.
* **Independent Test**: Create a test folder with a pre-configured valid `.minna/config.yaml` (with or without a `.minna/minna.db` file). Use the Add Project button to pick this folder. Assert that the configuration remains unchanged, the database is lazily created if missing, and the project is opened successfully.

### User Story 3 - Dedicated Error Modal for Invalid Projects (Priority: P1)
As an operator, I want to see a clear error dialog when selecting a corrupted project folder so that I know why it failed and my files are protected.
* **Why this priority**: Critical for data safety; prevents silent failures or accidental data overwriting.
* **Independent Test**: Select a directory containing a `.minna` folder with a missing or unparseable `config.yaml`. Assert that a dedicated error modal dialog appears in the UI displaying the specific validation failure, and the folder remains untouched.

### User Story 4 - Project ID Collision Resolution (Priority: P2)
As a developer, I want duplicate project folder names in different paths to receive unique IDs in the global registry so that their work items do not conflict.
* **Why this priority**: Avoids identity collisions across the central registry.
* **Independent Test**: Register a project at `/path/A/my-project`. Then register a project at `/path/B/my-project`. Assert that both are stored in `~/.minna/projects.db` with IDs `my-project` and `my-project-2` respectively.

### User Story 5 - CLI Registry Synchronization (Priority: P2)
As a CLI user, running Minna commands in a project directory should update its central registration status in the database.
* **Why this priority**: Keeps the list of recent projects consistent between the CLI and GUI tools.
* **Independent Test**: Execute a CLI command (e.g. `npm run cli status`) from a project directory, and check that `~/.minna/projects.db` has updated the project's `last_opened_at` timestamp to the current time.

### User Story 6 - Project Renaming & Relocating (Priority: P2)
As an operator, I want to edit a project's name and relocate its path so that my workspace is organized.
* **Why this priority**: Allows directory reorganizations without losing registry state.
* **Independent Test**: Rename a project from `A` to `B` and relocate its folder from path `/old` to `/new` (which has a valid `.minna/config.yaml`). Verify name and path are updated in the global projects database registry and UI sidebar, and the event timeline records `project.renamed` and `project.relocated`. Relocate to `/bad-path` (no config) and verify it is rejected via the Error Modal, leaving the registry unchanged. Relocate to an already-registered path and assert that it is rejected with a `400 Bad Request` validation error, leaving the registry unchanged.

### User Story 7 - Project Removal (Priority: P2)
As an operator, I want to remove a project from my workspace so that it no longer clutters my sidebar, without deleting my files on disk.
* **Why this priority**: Essential workspace decluttering.
* **Independent Test**: Remove a project. Assert the project row is deleted from the `projects` projection table, a `project.removed` event is written, and the folder and files on disk are completely untouched.
* **Acceptance Scenarios**:
  1. **Given** Project A is registered in the workspace, **When** the user removes Project A from the registry, **Then** Project A is deregistered, removed from the sidebar, and all files on disk are completely untouched.
  2. **Given** Project A is currently opened and active in the workspace, **When** the user removes Project A from the registry, **Then** Project A is deregistered, removed from the sidebar, the workspace context updates to unselect Project A (setting the active project context to `null`), and the UI displays the empty screen/default dashboard state.

### User Story 8 - Ongoing Project Health Checks (Priority: P1)
As an operator, I want Minna to verify project integrity on load so that unavailable or corrupted project entries do not cause runtime errors.
* **Why this priority**: Prevents UI errors from dead links or deleted config files.
* **Independent Test**: Create two projects. Delete `.minna/config.yaml` from the second project's folder. Reload the application. Assert that the second project's row displays as muted/disabled in the sidebar and is non-clickable.

## Edge Cases

- **File System Permissions**: If the app lacks write permissions to `~/.minna/` or the chosen project directory, it should display a permission error modal and not corrupt any existing registry state.
- **Unavailable Projects**: If a registered project path no longer resolves on disk when the app loads, the sidebar displays it in a muted, disabled "unavailable" state and prevents clicking it.
- **Concurrent Writes (Locking)**: If both the CLI and Next.js app read/write `~/.minna/projects.db` concurrently, SQLite transaction locking (via WAL mode and BEGIN IMMEDIATE/EXCLUSIVE transactions) prevents lost updates and guarantees serialization.
- **Malformed Database File**: If `~/.minna/projects.db` becomes corrupted, it fails closed, raising a warning and refusing to overwrite existing user data before manual database inspection.
- **Relocating to an Unrelated Valid Project**: If the user relocates a project to an unrelated directory that contains a valid `.minna/config.yaml` (and is not already registered under another ID), the registry will accept the update. This is an accepted risk, as relocation is a user-directed action.

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
  - `type`: TEXT (`"project.registered" | "project.opened" | "project.renamed" | "project.relocated" | "project.removed"`)
  - `payload`: TEXT (JSON string containing the payload object: e.g. `{ id, name, path }` or `{ id }`)
- `projects` Projection Table:
  - `id`: TEXT PRIMARY KEY
  - `name`: TEXT (casing preserved)
  - `path`: TEXT (unique folder path)
  - `last_opened_at`: TEXT (ISO 8601 string)

## References

This feature shall conform to the following project documents:

- [docs/minna-project-registry.md](file:///D:/Alvin/_CodeProjects/Project_Minna/docs/minna-project-registry.md) (Registry v3)
- [docs/features/v1.0.0-minna-foundations/002-project-creation.md](file:///D:/Alvin/_CodeProjects/Project_Minna/docs/features/v1.0.0-minna-foundations/002-project-creation.md)
