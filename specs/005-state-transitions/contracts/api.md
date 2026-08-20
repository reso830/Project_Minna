# API Contract: Feature 005 State Transitions

## Unified State Transition Endpoint

### `PATCH /api/work-items/[id]/state`

Transitions a work item's state and updates its closed reason if transitioning to `closed`.

#### Request

- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "project": "<project-id>",
    "state": "parked | active | blocked | closed",
    "blocked_reason": "clarification-required | approval-required | external-dependency | ci-pending | failed",
    "closed_reason": "done | dropped | failed"
  }
  ```
  *(Note: `project` is required, matching the existing `PATCH /api/work-items/[id]` and (removed) `POST /api/work-items/[id]/drop` conventions — it resolves which project's local SQLite database to open via `createRepositories`. `blocked_reason` is required if `state` is `"blocked"`; `closed_reason` is required if `state` is `"closed"`. Both must otherwise be omitted or null.)*

#### Success Response (`200 OK`)

- **Body**: Updated `WorkItem` object.
  ```json
  {
    "id": "001",
    "title": "journal-view",
    "description": "Implement Journal View",
    "state": "active",
    "phase": "spec",
    "work_item_type": "feature",
    "blocked_reason": null,
    "closed_reason": null,
    "assignee": "minna",
    "project": "minna",
    "branch": "001-journal-view",
    "pr_url": null,
    "feature_brief_path": ".minna/features/001-journal-view.md",
    "created_at": "2026-07-24T09:00:00Z",
    "updated_at": "2026-08-19T13:50:00Z"
  }
  ```

#### Error Response: Illegal Transition (`422 Unprocessable Entity`)

Returned when an illegal state transition is attempted (e.g. `parked → blocked` or `closed → active`).

- **Body**:
  ```json
  {
    "error": "Illegal state transition from 'parked' to 'blocked'.",
    "from": "parked",
    "to": "blocked",
    "allowed": ["active", "closed"]
  }
  ```

#### Error Response: Bad Request (`400 Bad Request`)

Returned when parameters are malformed (e.g., `project` or `state` is missing or invalid, `blocked_reason` is invalid or omitted when transitioning to `blocked`, or `closed_reason` is omitted when transitioning to `closed`).

- **Body**:
  ```json
  {
    "error": "Missing required field: project"
  }
  ```
  or
  ```json
  {
    "error": "closed_reason is required when state is 'closed'."
  }
  ```

#### Error Response: Project Not Found (`404 Not Found`)

Returned when `project` does not resolve to a registered project.

- **Body**:
  ```json
  {
    "error": "Project 'celia' not found."
  }
  ```

#### Error Response: Work Item Not Found (`404 Not Found`)

- **Body**:
  ```json
  {
    "error": "Work item '999' was not found."
  }
  ```

---

## Removed Endpoints

### `POST /api/work-items/[id]/drop`

- **Status**: **REMOVED**
- **Result**: Hitting this endpoint returns `404 Not Found`. Callers must use `PATCH /api/work-items/[id]/state` with `{ "project": "<project-id>", "state": "closed", "closed_reason": "dropped" }`.
