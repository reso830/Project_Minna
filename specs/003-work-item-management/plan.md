# Implementation Plan: Work Item Management

**Branch**: `003-work-item-management` | **Date**: 2026-07-31 | **Spec**: [spec.md](file:///D:/Alvin/_CodeProjects/Project_Minna/specs/003-work-item-management/spec.md)
**Input**: Feature specification from [spec.md](file:///D:/Alvin/_CodeProjects/Project_Minna/specs/003-work-item-management/spec.md)

## Summary

This plan outlines the architecture, data flow, affected components, and validation approach for implementing Work Item Management.
We will introduce project-scoped backlogs of work items (limited to the `feature` type for this phase). Work items are persisted locally in `.minna/minna.db` (SQLite) via a repository abstraction `createRepositories(config)`. Mentions of hosted Supabase/PostgreSQL storage are deferred to a future phase to avoid introducing external dependencies or violating Constitution Principle XVI.

A work item's rich details (freeform text or file selection) are normalized into a standalone Markdown file at `.minna/features/<id>-<title>.md` using a transactional file-write pipeline. The database stores its file path (`feature_brief_path`). UI CRUD operations (creating, updating description, soft-dropping) are integrated into the left sidebar with blocking modal confirmations. The full item metadata is rendered in the main details view.

## Technical Context

- **Language/Version**: TypeScript / Node.js 22+ (Next.js 15 App Router)
- **Primary Dependencies**: React (styled with Vanilla CSS and custom inline SVG components to match package.json)
- **Storage**: Local SQLite (`.minna/minna.db` using Node's `DatabaseSync` helper) routed through `createRepositories(config)`.
- **Testing**: Jest / React Testing Library for frontend/core, node's built-in test runner for CLI/unit tests.
- **Target Platform**: Desktop (Chrome, Edge, Firefox, Safari) and local shell environments (Windows PowerShell/bash).
- **Project Type**: Web application (Next.js app) + CLI.
- **Performance Goals**: UI rendering/state updates <50ms; database writes/reads <100ms.
- **Constraints**: 100-character description limit; single brief file per work item; offline-capable; strict transactional event integrity.
- **Scale/Scope**: Single project backlogs up to 1,000 features. Monotonically increasing sequential IDs are 3-digit zero-padded strings. If the counter exceeds `999`, it naturally expands to four digits (e.g. `1000`) rather than rolling over.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Human Authority & Decision-Making
- **Compliance**: The UI relies on explicit human gates (e.g. Save, Drop, Discard modal confirmations) to mutate state, and presents clear error states rather than making automated assumptions.

### II. Deterministic Orchestration
- **Compliance**: Work item state transitions (e.g. `parked` to `closed` on drop) are explicit and recorded as deterministic lifecycle events. Authors/roles are tracked.

### III. State Is The Source Of Truth
- **Compliance**: State mutations write a lifecycle event (`work_item.created` or `work_item.state_changed`) and update the projection table (`work_items`) in the **same transaction**.

### IV. Thin Interfaces & Core Logic
- **Compliance**: Database query and mutation logic is isolated in repository classes. Next.js API handlers and CLI commands are thin wrappers around the core repository methods, avoiding logic duplication.

### VI. Local-First, Inspectable State
- **Compliance**: Local mode writes to a standard SQLite database. Large feature details are saved as readable Markdown files (`.minna/features/<id>-<title>.md`) to remain version-control friendly and relocation-safe.

### XIII. Minna Owns Git; Agents Are Subprocesses
- **Compliance**: This feature focuses strictly on work items and details persistence. Git commands are excluded from the scope.

### XVI. Cost & Quota Are First-Class
- **Compliance**: Operations run locally on free/offline resources. No hosted services or paid external APIs are introduced.

## Affected Areas

### Files/Components to Inspect
- [src/core/db.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/db.ts): Database schemas and triggers.
- [src/core/work-items.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/work-items.ts): Current SQLite work item query logic.
- [src/components/Sidebar.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/Sidebar.tsx): Project lists and hover affordance triggers.
- [src/components/CenterPanel.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/CenterPanel.tsx): Header rendering for selected items.
- [src/components/WorkspaceProvider.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/WorkspaceProvider.tsx): Global state context.

### Files/Components to Modify
- [src/core/db.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/db.ts): 
  - Add `closed_reason`, `feature_brief_path`, `spec_path`, `plan_path`, and `tasks_path` columns to the `work_items` table schema. Description limits (100 characters max) are validated strictly at the core service / API level rather than retrofit database constraints to prevent breaking SQLite table-alterations on existing projects.
  - Implement a lazy SQL migration handler (`migrateWorkItemsColumns`) to update existing databases on initialization.
  - Implement the `migrateEventsProjectColumn` migration. To bypass SQLite constraints on non-empty tables, the column is added as nullable (`ALTER TABLE events ADD COLUMN project TEXT`), followed by backfilling logic. The project key is passed explicitly to `initDb(dbPath, projectKey)` at migration time. Events with a `work_item_id` are backfilled using `work_items.project` lookup, and any remaining system/git events are backfilled using the passed `projectKey`. If `projectKey` is omitted, it falls back to the slugified database parent folder basename.
- [src/core/types.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts): Update `WorkItem` and `Phase` types with the new fields and canonical enums.
- [src/core/work-items.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/work-items.ts): 
  - Refactor to implement `createRepositories(config)` supporting SQLite repositories.
  - Update `UpdateWorkItemStateInput` and the update statement to persist `closed_reason`.
  - Update state changed event payload structure to construct `{ from, to, blocked_reason, closed_reason }` payloads rather than nested config values.
  - Encapsulate all creation logic (slugification, sequential ID generation, event logging, database writing, and file transactions) in `createWorkItem(db, actor, input)` so Next.js route handlers and CLI commands remain thin wrappers.
  - Automate sequential, project-scoped 3-digit ID generation (`001`, `002`) inside the transaction block.
  - Automatically slugify titles on save.
- [src/components/Sidebar.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/Sidebar.tsx):
  - Indent work items 20px under their project.
  - Display ID, Title (slugified, CSS truncated), and status color dot.
  - Render pencil icon on hover, which opens the Update Feature modal.
  - Render "+" popover option "Add Feature" next to the project row.
- [src/components/CenterPanel.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/CenterPanel.tsx):
  - Render the selected work item details: ID, Title, Description, Type (`feature`), State, Phase (`spec`, `plan`, `tasks`, `spec-review`, `implement`, `review`, `integrate`), and Assignee (`unassigned` or current value).
  - Handle missing details brief gracefully: if `feature_brief_path` is set but the file is missing, render a warning banner ("Warning: Brief file not found. Click edit to recreate.") rather than crashing.
- [src/components/WorkspaceProvider.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/WorkspaceProvider.tsx):
  - Connect state to work item API endpoints.
  - Maintain selections and trigger modals.
- [src/cli.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/cli.ts): Update `start-feature` command to use the updated `createWorkItem` signature and pass project context key to `initDb`.
- [src/core/registry.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/registry.ts): Pass the registered project key to `initDb` calls inside `prepareProject`.

### New Files to Create
- `src/core/repositories/types.ts`: Repository interfaces (`IWorkItemsRepository`, `IEventsRepository`).
- `src/core/repositories/sqlite.ts`: SQLite implementation of the interfaces.
- `src/core/repositories/factory.ts`: Export `createRepositories(config)` routing logic.
- `src/app/api/work-items/route.ts`: API endpoint for listing and creating work items.
- `src/app/api/work-items/[id]/route.ts`: API endpoint for retrieving and updating work item descriptions/briefs.
- `src/app/api/work-items/[id]/drop/route.ts`: API endpoint to soft-drop/archive work items.
- `src/components/AddUpdateFeatureModal.tsx`: Shared modal matching design requirements (tabs, file pickers, inputs).
- `src/components/DropConfirmModal.tsx`: Confirmation modal for soft-dropping features.

### Transactional File-Write & Atomic Recovery Pipeline
To prevent data corruption (database record pointing to a missing brief file, or orphaned files on disk due to rollback failures):
1. **Write to Temporary File**: Before launching the database transaction, write details/brief text to a temporary path under the project workspace: `.minna/features/.<id>-<title>.tmp`. (Both creation and PATCH updates reuse this exact pipeline).
2. **Execute Transaction**: Open the database transaction. Insert/update the work item and log the lifecycle events, referencing the expected final path `.minna/features/<id>-<title>.md`.
3. **Commit Transaction**: Commit changes to the SQLite database.
4. **Atomically Rename File**: Rename `.minna/features/.<id>-<title>.tmp` to `.minna/features/<id>-<title>.md`.
5. **Rollback Handling**: If the database transaction fails to commit, delete the temporary file from disk in the catch/cleanup block and abort.
6. **Rename Fail Recovery (Self-Healing)**: If the database transaction successfully commits but the rename step fails (e.g. sudden power loss or process kill):
   - On subsequent reads, if the expected `.md` brief file is missing but the `.tmp` file exists, the repository automatically self-heals by renaming `.tmp` to `.md`.
   - If both files are missing, the details panel UI degrades gracefully by rendering a warning banner, allowing the user to click edit to save/recreate the file.

### Tests to Add or Update
- `src/core/__tests__/repositories.test.ts`: Verify SQLite repositories, database column migrations with non-empty tables and explicit project backfills, ID rollovers, atomic file-write pipelines, and self-healing.
- `src/app/api/work-items/__tests__/work-items.test.ts`: Integration tests for work item CRUD and drop endpoints.
- `src/components/__tests__/AddUpdateFeatureModal.test.tsx`: Verify dialog validation, text input restrictions (100 char description limit), file selection, and dirty checks.

### Out of Scope
- Issue creation workflows (all items are created as features).
- Git repository commits, checkouts, or push integrations.
- Agent sessions and actual spec/plan execution workflows.
- Hosted Supabase backend integration (deferred).

## Project Structure

### Documentation (this feature)

```text
specs/003-work-item-management/
├── spec.md              # Feature specification
├── plan.md              # This implementation plan
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 data design
├── quickstart.md        # Phase 1 quickstart instructions
├── contracts/
│   └── api.md           # Phase 1 REST API contracts
└── checklists/
    ├── requirements.md  # Spec checklist
    └── plan-review.md   # Pre-implementation checklist
```

### Source Code

```text
src/
├── app/
│   └── api/
│       └── work-items/
│           ├── route.ts
│           └── [id]/
│               ├── route.ts
│               └── drop/
│                   └── route.ts
├── components/
│   ├── AddUpdateFeatureModal.tsx
│   ├── DropConfirmModal.tsx
│   ├── Sidebar.tsx
│   └── WorkspaceProvider.tsx
├── core/
│   ├── repositories/
│   │   ├── factory.ts
│   │   ├── sqlite.ts
│   │   └── types.ts
│   ├── db.ts
│   ├── types.ts
│   └── work-items.ts
└── cli.ts
```

**Structure Decision**: Standard Next.js + Core model. We isolate the repositories pattern in `src/core/repositories/` to handle local SQLite database layers.

## Complexity Tracking

*No constitutional check violations exist. We defer Supabase integration to follow strict cost and quota constraints.*
