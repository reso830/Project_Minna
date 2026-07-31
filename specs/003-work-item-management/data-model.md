# Data Model Design: Work Item Management

**Feature Branch**: `003-work-item-management`

This document defines the schema, validations, and constraints for the work item management data model. All persistence routes through a local SQLite database runtime, with hosted Supabase integration deferred.

---

## 1. Local Runtime Schema (SQLite)

The `work_items` table is updated in `.minna/minna.db` with the following columns:

```sql
CREATE TABLE IF NOT EXISTS work_items (
  id TEXT PRIMARY KEY,                          -- Project-scoped sequential counter (e.g. "001"). Expands to 4 digits if > 999.
  title TEXT NOT NULL,                          -- Slugified title (lowercase, alphanumeric + hyphens only)
  description TEXT NOT NULL,                    -- Short description (strict 100 character max limit validated at core/API levels)
  state TEXT NOT NULL,                          -- parked | active | blocked | closed
  phase TEXT NOT NULL,                          -- spec | plan | tasks | spec-review | implement | review | integrate
  work_item_type TEXT NOT NULL,                 -- feature | issue (issue deferred)
  blocked_reason TEXT,                          -- clarification-required | approval-required | external-dependency | ci-pending | failed
  closed_reason TEXT,                           -- done | dropped | failed
  assignee TEXT,                                -- human | minna | claude | codex | agy | null
  project TEXT NOT NULL,                        -- Project ID key
  branch TEXT,                                  -- <id>-<title> | null
  pr_url TEXT,                                  -- Pull Request URL | null
  feature_brief_path TEXT,                      -- .minna/features/<id>-<title>.md | null
  spec_path TEXT,                               -- Path to spec.md | null (reserved)
  plan_path TEXT,                               -- Path to plan.md | null (reserved)
  tasks_path TEXT,                              -- Path to tasks.md | null (reserved)
  created_at TEXT NOT NULL,                     -- ISO 8601 UTC timestamp
  updated_at TEXT NOT NULL                      -- ISO 8601 UTC timestamp
);
```

The `events` table (SQLite) is updated to include the `project` column:

```sql
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,                      -- ISO 8601 UTC timestamp
  actor TEXT NOT NULL,                          -- human | minna | claude | codex | agy
  type TEXT NOT NULL,                           -- Event type string
  payload TEXT NOT NULL,                        -- JSON stringified payload
  work_item_id TEXT,                            -- Associated work item ID (nullable)
  project TEXT,                                 -- Associated project ID key (nullable to support migration backfills, enforced in code)
  summary TEXT,                                 -- Human readable summary
  artifact_path TEXT                            -- Associated file path (nullable)
);
```

### Migration Backfill Policy for events.project
Adding a column to a populated SQLite table does not support the `NOT NULL` constraint without a default value. To safely perform migration of existing tables:
1. **Migration**: Execute `ALTER TABLE events ADD COLUMN project TEXT;` if the column is missing.
2. **Backfill linked events**:
   ```sql
   UPDATE events 
   SET project = (SELECT project FROM work_items WHERE work_items.id = events.work_item_id) 
   WHERE work_item_id IS NOT NULL AND project IS NULL;
   ```
3. **Backfill unlinked/system events**:
   The caller passes the resolved project ID key (e.g. `celia` or `celia-2`) explicitly to the database initialization handler `initDb(dbPath, projectKey)`. Any remaining null project values are updated to match this key:
   ```sql
   UPDATE events 
   SET project = ? 
   WHERE project IS NULL;
   ```
   If `projectKey` is omitted, the migration falls back to the slugified folder basename parsed from the database path `dbPath`.

---

## 2. Data Integrity & Validation Rules

- **ID Generation**: Monotonically increasing sequential ID scoped to the project. Begins at `001`. Expands to four digits (e.g. `1000`) if the backlog exceeds `999` features.
- **Slugified Title Validation**: Must be derived by lowercasing and replacing whitespace/special characters with hyphens. Max length: 50 characters. Immutable.
- **Description Length**: Maximum of 100 characters. Checked and validated strictly at the core repository methods and Next.js/React controllers (as SQLite doesn't support retrospectively altering pre-existing columns to add check constraints).
- **State Transition Policies**:
  - Valid transitions to `closed` with `closed_reason = dropped` (soft drop): `parked` -> `closed`, `active` -> `closed`, `blocked` -> `closed`.
  - Already `closed` items cannot transition or be dropped. `closed_reason` is immutable once set.
  - `blocked_reason` must be set if state is `blocked`, and must be `null` for all other states.
  - `closed_reason` must be set if state is `closed`, and must be `null` for all other states.
- **Parked-Item Phase Rule**:
  - The database records a phase at all times. However, per the state model, this phase is only considered "active" (work is ongoing) when the work item's state is `active`. When state is `parked`, the phase tracks the starting position.
