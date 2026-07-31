# Feature Specification: Work Item Management

**Feature Branch**: `003-work-item-management`
**Created**: 2026-07-31
**Status**: Draft
**Input**: [003-work-item-management.md](file:///D:/Alvin/_CodeProjects/Project_Minna/docs/features/v1.0.0-minna-foundations/003-work-item-management.md)

## Clarifications

### Session 2026-07-31

- **Q**: How is the work item Type selector (`feature` vs. `issue`) exposed in the UI? The design handoff mockup modal only lists Title, Description, and Details, and the sidebar "+" popover has only "Add Feature".
  → **A**: All work items created in this phase are restricted to the `feature` type, meaning no type selector is required in the UI. Issue-type work items are deferred to a later feature.
- **Q**: Should the `FEATURE DETAILS` textarea and file attachment fields be stored in the database (`.minna/minna.db`), or are these fields purely UI-based for this phase and deferred/ignored for backend storage?
  → **A**: The details content (freeform text or file selection) is normalized into a single Markdown file at `.minna/features/<id>-<title>.md` on save, and the work item record stores `feature_brief_path` pointing to this file. The work item also includes sibling fields `spec_path`, `plan_path`, and `tasks_path` initialized to `null`. Text is never stored inline in the database.
- **Q**: Should the "Remove Feature" action physically delete the record and events from the SQLite database (as per the design handoff), or should it transition the state to `closed` with `closed_reason = dropped` as a soft drop/archive (as per the feature brief)?
  → **A**: Soft-drop only. The state transitions to `closed` with `closed_reason = dropped`, and we never physically delete work items or event journal records. UI text/modals are corrected to "Drop Feature"/"Archive Feature" to align with this non-destructive behavior.
- **Q**: What are the valid source states from which an operator can drop/remove a work item?
  → **A**: Any non-closed state (`parked`, `active`, `blocked`) can transition to `closed` with `closed_reason = dropped`. Transition is disabled for already closed items, and `closed_reason` is immutable once set.
- **Q**: How does the parked-item phase rule apply since new items are created parked with a non-null phase, but the state model says phases apply only when `state = active`?
  → **A**: A work item stores a phase (e.g., `spec` or `implement`) at all times to track its position in the lifecycle. However, per the state model, this phase is only "active" (work is ongoing) when the work item's state is `active`. For a `parked` item, the phase represents the phase it will start in when activated.
- **Q**: How does the UI display Type, State, Phase, Assignee, and Description if the approved sidebar design only surfaces status dot + ID + title?
  → **A**: The sidebar surfaces status dot + ID + title. When a work item is selected, the `CenterPanel` (Work Item Details view) displays the full metadata: ID, Title, Description, Type (`feature`), State, Phase (canonical name), and Assignee.
- **Q**: What happens to sequential IDs if the project backlog counter exceeds `999`? The brief specifies "three-digit identifiers (e.g. `001`, `002`)".
  → **A**: If the sequential counter exceeds `999`, the ID naturally expands to four digits (e.g. `1000`, `1001`) to preserve monotonicity and uniqueness rather than truncating, rolling over, or throwing an error.

## Problem Statement

Minna tracks projects and feature roadmaps. To support the execution of tasks, Minna needs a robust way to represent, persist, and manage individual units of work (work items). Currently, projects exist, but there is no backlog or tracking of what tasks are planned or completed.
This feature introduces project-scoped backlogs of work items (Features and Issues). It implements local persistence in `.minna/minna.db`, interactive UI CRUD operations (creation, updating description, dropping/archiving) integrated into the sidebar, and structured events recorded in the event journal.

## Scope

### In Scope
- **Work Item Database Persistence**: Store work items in local project SQLite databases (`.minna/minna.db`) under the `work_items` table, updating event logs in the `events` table in the same transaction.
- **Create Work Item**:
  - Inputs: Type (`feature`), Title, Description.
  - Automatically slugify freeform titles upon creation (lowercase, replace spaces with hyphens, remove unsupported characters) and discard the original freeform title.
  - Slugified titles are immutable after creation.
  - Enforce a strict 100-character limit on the Description input field.
  - Generate a sequential, project-scoped 3-digit ID (e.g., `001`, `002`) using a project-scoped monotonically increasing counter. If the sequential ID exceeds `999`, it naturally expands to four digits (e.g., `1000`) to preserve monotonicity and uniqueness.
  - Auto-initialize state to `parked`.
  - Auto-initialize phase: `spec` for features.
  - Set created/updated timestamps.
  - Set `blocked_reason = null`, `closed_reason = null`, `branch = null`, `pr_url = null`, `assignee = null`, `spec_path = null`, `plan_path = null`, `tasks_path = null`.
- **Feature Brief Path & Normalization**:
  - Typed brief content is normalized and written out to `.minna/features/<id>-<title>.md`.
  - Selected external `.md` files are copied to `.minna/features/<id>-<title>.md` (renamed to match the convention, leaving the source file untouched).
  - Subsequent attachments/saves overwrite the target file.
  - The database field `feature_brief_path` stores the relative path `.minna/features/<id>-<title>.md` (or `null` if none was provided).
- **Update Work Item**:
  - Allow users to edit the Description field and the Feature Details (text textarea or attached file).
  - Editing Feature Details updates the content/file at the path stored in `feature_brief_path`.
  - All other fields (ID, Title, Project, State, Phase, timestamps) are immutable.
- **Drop Work Item**:
  - Prevent physical deletion of work items. Mark them as dropped by transitioning state to `closed` and setting `closed_reason = dropped`.
  - Wording in the UI should reflect "Drop Feature" or "Archive Feature" rather than "Delete/Remove".
- **Work Item List & Details**:
  - Display all work items indented under their project row in the left sidebar, surfacing status dot, ID, and title.
  - When selected, display full details (ID, Title, Type, State, Phase, Assignee, Description) inside the main `CenterPanel` area.
  - Support simple client-side sorting and filtering.
- **UI Hover Affordances & Modals**:
  - Project row hover reveals a "+" icon, which opens a popover containing the "Add Feature" action.
  - Feature row hover reveals a pencil icon, which opens the edit modal in "Update Feature" mode.
  - Modals: Add/Update modal (520px wide), Discard confirmation (380px wide), Drop confirmation (400px wide).

### Non-Goals
- Issue creation/type selection (deferred to a later feature).
- State transition workflows (aside from dropping/archiving).
- Phase transition workflows (aside from initial assignment).
- Board view / Kanban boards.
- Journal generation or agent execution session runs.
- Git repository integration (automatic branch creation, commits, PRs, etc.).
- Multi-user authentication or role management.

## User Scenarios & Testing

### User Story 1 - Create Work Items (Priority: P1)
As an operator, I want to create feature work items within a project so that I can define my backlog.
* **Why this priority**: Essential to build the backlog; the starting point of any work.
* **Independent Test**: Open the application, select a project, click the "+" icon on the project row, and choose "Add Feature". Fill in the title "My New Feature", description, and details. Click Save. Verify that the new item is created in the database and sidebar with status `parked`, phase `spec`, and ID `001`. Verify that `.minna/features/001-my-new-feature.md` contains the details entered.
* **Acceptance Scenarios**:
  1. **Given** a project exists and is active, **When** the user creates a new Feature work item with title "Setup Auth" and description "Adds user auth", **Then** the title is slugified to "setup-auth" and stored, state is `parked`, phase is `spec`, and ID is generated as a 3-digit string.
  2. **Given** the user inputs a brief in the details tab, **When** the feature is saved, **Then** the brief is saved to `.minna/features/<id>-<title>.md` and the path is stored in `feature_brief_path`.

### User Story 2 - Work Item List (Priority: P1)
As an operator, I want to view the list of work items in my project's backlog so that I can see the overview of planned work.
* **Why this priority**: Crucial for tracking progress and reviewing the backlog.
* **Independent Test**: Seed the local database with three work items. Open the project in the UI and verify that the sidebar displays all three work items, showing their ID, slugified title, status indicator, and phase.
* **Acceptance Scenarios**:
  1. **Given** work items exist in the project, **When** the project is loaded, **Then** the sidebar displays all work items indented under the project row, ordered by creation.

### User Story 3 - Update Work Item (Priority: P2)
As an operator, I want to edit the description and details of a work item so that I can refine its details as requirements change.
* **Why this priority**: Allows backlog refinement without modifying immutable properties.
* **Independent Test**: Open the edit modal for work item `001`. Modify the description text and details text, and click Save. Verify that the description and details file are updated in the database and UI, and the title and ID remain unchanged.
* **Acceptance Scenarios**:
  1. **Given** work item `001` exists, **When** the user updates the description field in the edit modal, **Then** the description is persisted and `updated_at` is updated.
  2. **Given** work item `001` exists, **When** the user opens the edit modal, **Then** the title input is read-only and disabled.

### User Story 4 - Drop Work Item (Priority: P2)
As an operator, I want to drop a work item from the backlog when it is no longer needed.
* **Why this priority**: Allows cleanup of obsolete or abandoned tasks without violating journal integrity.
* **Independent Test**: Select a work item in the backlog and click the "Drop Feature" button. Confirm the dialog. Verify that the work item's state transitions to `closed` with `closed_reason = dropped` in the database, a `work_item.state_changed` event is logged in `.minna/minna.db`, and all files are untouched.
* **Acceptance Scenarios**:
  1. **Given** a work item exists in state `parked`, `active`, or `blocked`, **When** the user drops the work item, **Then** the confirmation modal is shown. If confirmed, the item state transitions to `closed` with `closed_reason = dropped`, and a lifecycle event is logged.
  2. **Given** a work item is currently active in the workspace, **When** the user drops the work item, **Then** the workspace context updates to unselect it and selects feature `001`.

## Edge Cases
- **File System Permissions**: If the app lacks write permissions to write files under `.minna/features/` or `.minna/minna.db`, it should display a permission error modal and not corrupt any existing state.
- **Concurrent Writes (Locking)**: If multiple interfaces (e.g. Next.js app and CLI) write to the SQLite database concurrently, SQLite transaction locking (via WAL mode and BEGIN IMMEDIATE/EXCLUSIVE transactions) prevents lost updates.
- **Malformed Database File**: If `.minna/minna.db` becomes corrupted, it fails closed, raising a warning.
- **Title Character Stripping**: Slugifying titles must strip out invalid characters (e.g., emojis, slashes, backslashes, quotes) to avoid breaking URL routes, branch names, or command execution later.
- **Overwriting Pre-existing Briefs**: When re-attaching or updating a brief, the target file under `.minna/features/<id>-<title>.md` is overwritten directly, and no duplicate file path is registered.

## Data Considerations

### Local Project Event Database (`.minna/minna.db`)
Inside each project's directory:
- `work_items` Table:
  - `id`: TEXT PRIMARY KEY (e.g., `"001"`, `"002"`)
  - `title`: TEXT NOT NULL (slugified title)
  - `description`: TEXT NOT NULL (max 100 characters)
  - `state`: TEXT NOT NULL (`"parked" | "active" | "blocked" | "closed"`)
  - `phase`: TEXT NOT NULL (`"spec" | "plan" | "tasks" | "spec-review" | "implement" | "review" | "integrate"`)
  - `work_item_type`: TEXT NOT NULL (`"feature" | "issue"`)
  - `blocked_reason`: TEXT (nullable)
  - `closed_reason`: TEXT (nullable)
  - `assignee`: TEXT (nullable)
  - `project`: TEXT NOT NULL (project ID)
  - `branch`: TEXT (nullable)
  - `pr_url`: TEXT (nullable)
  - `feature_brief_path`: TEXT (nullable, path to `.minna/features/<id>-<title>.md`)
  - `spec_path`: TEXT (nullable, reserved for future spec phases)
  - `plan_path`: TEXT (nullable, reserved for future planning phases)
  - `tasks_path`: TEXT (nullable, reserved for future tasks phases)
  - `created_at`: TEXT NOT NULL (ISO 8601 string)
  - `updated_at`: TEXT NOT NULL (ISO 8601 string)

- `events` Table updates (recorded in the same transaction as state/creation changes):
  - `timestamp`: TEXT NOT NULL (ISO 8601 string)
  - `actor`: TEXT NOT NULL (`"human" | "minna" | "claude" | "codex" | "agy"`)
  - `type`: TEXT NOT NULL (`"work_item.created" | "work_item.state_changed" | "work_item.phase_changed" | ...`)
  - `payload`: TEXT NOT NULL (JSON string containing details)
  - `work_item_id`: TEXT
  - `summary`: TEXT
  - `artifact_path`: TEXT (nullable)
