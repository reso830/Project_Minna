# Research Notes: Work Item Management

**Feature**: Work Item Management | **Feature Branch**: `003-work-item-management`

These research notes address key technical challenges, technology choices, and architectural decisions required to implement Work Item Management.

---

## Technical Decisions

### Decision 1: Repository Pattern for SQLite Core

* **Problem Statement**: Minna needs clean separation between Next.js API endpoint handlers/CLI commands and SQLite query logic to enforce the single-responsibility principle.
* **Technology Options**:
  1. *Option A (Inline DB execution)*: Direct SQLite statements in route handlers.
  2. *Option B (Repository Pattern)*: Define TypeScript repository interfaces for work items and events, creating a concrete class for SQLite.
* **Decision**: **Option B (Repository Pattern)**.
* **Rationale**:
  - Encapsulates database execution, transaction handling, and schema mapping.
  - Allows Next.js handlers and CLI commands to remain thin controller wrappers (Constitution Principle IV).
  - Deferring hosted Supabase (PostgreSQL) support avoids external libraries and costs (Constitution Principle XVI). If hosted persistence is added later, we only need to write a new class implementing the interfaces.

---

### Decision 2: Sequential, Project-Scoped ID Generation with Rollover

* **Problem Statement**: Work items require sequential IDs (e.g. `001`, `002`) scoped to the project, never reused.
* **Decision**: Monotonic counter increment queried inside the write transaction: `SELECT MAX(CAST(id AS INTEGER)) AS max_id FROM work_items WHERE project = ?`.
* **Rollover Rule**: If a project exceeds `999` work items, the ID naturally expands to four digits (e.g. `1000`, `1001`) rather than rolling over or truncating. This ensures IDs remain unique and sequential.

---

### Decision 3: Details File Normalization

* **Problem Statement**: Detailed briefs (up to 2500 characters) are written to local Markdown files under `.minna/features/<id>-<title>.md`, and the relative path is stored as `feature_brief_path`.
* **Rationale**: Keeps database size small, and enables local-first inspectability and version-control mapping (Constitution Principle VI).

---

### Decision 4: Self-Healing SQLite Schema Migration & Backfill Strategy

* **Problem Statement**: Pre-existing SQLite files must be lazily updated to support work item v3 columns and event project fields. Adding `events.project TEXT NOT NULL` fails on non-empty tables.
* **Decision**: Implement a progressive migration strategy on repository initialization:
  1. For `work_items`, query `PRAGMA table_info` and run `ALTER TABLE ADD COLUMN` for missing columns.
  2. For `events`, add the `project` column as nullable: `ALTER TABLE events ADD COLUMN project TEXT`.
  3. Execute backfill queries:
     - Associate events with `work_items` using `work_item_id` to copy the correct project key:
       `UPDATE events SET project = (SELECT project FROM work_items WHERE work_items.id = events.work_item_id) WHERE work_item_id IS NOT NULL AND project IS NULL;`
     - Backfill system events with no `work_item_id` by grabbing the project name from the slugified database file path (derived from the database path in the initialization handler):
       `UPDATE events SET project = ? WHERE project IS NULL;`
  4. Ensure all future query structures and writes enforce and populate the project field.

---

### Decision 5: Transactional File-Write & Atomic Recovery Pipeline (Create & Update)

* **Problem Statement**: Writing detail briefs to files and updating database tables can fail independently, leaving state corrupted.
* **Decision**: Both feature creation and PATCH updates use a transaction-safe file pipeline:
  1. Write detail text to a temporary file: `.minna/features/.<id>-<title>.tmp`.
  2. Start database transaction.
  3. Insert/update work item row and log lifecycle events.
  4. Commit database transaction.
  5. Atomically rename the temporary file to `.minna/features/<id>-<title>.md` (overwriting the old brief file in PATCH mode).
  6. If transaction fails before commit, delete the temporary file from disk in the catch block.
* **Rename Failure Compensation (Self-Healing)**:
  - If the database commit succeeds but the rename step fails (due to power loss, disk full, etc.):
    - **Self-Healing on Read**: On subsequent work item reads, if the expected `.md` brief is missing but the `.tmp` file exists, the repository automatically re-runs the rename to `.md`.
    - **Graceful UI Degradation**: If both are missing, the UI displays a warning banner ("Warning: Brief file not found. Click edit to recreate.") rather than throwing an error or crashing.
