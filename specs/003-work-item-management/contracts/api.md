# API Contracts: Work Item Management

**Feature Branch**: `003-work-item-management`

This document defines the Next.js API endpoints for work item creation, querying, updates, and soft-dropping. All endpoints connect to the local project database.

---

## 1. List Work Items

* **Endpoint**: `GET /api/work-items`
* **Query Parameters**:
  - `project` (string, required): The ID of the project whose backlog is being requested.
* **Success Response (200 OK)**:
  - Header: `Content-Type: application/json`
  - Body: Array of `WorkItem` objects.
  ```json
  [
    {
      "id": "001",
      "title": "refund-flow-redesign",
      "description": "Lets users retry failed payments automatically",
      "state": "parked",
      "phase": "spec",
      "phase_group": "define",
      "work_item_type": "feature",
      "blocked_reason": null,
      "closed_reason": null,
      "assignee": null,
      "project": "my-project",
      "branch": null,
      "pr_url": null,
      "feature_brief_path": ".minna/features/001-refund-flow-redesign.md",
      "spec_path": null,
      "plan_path": null,
      "tasks_path": null,
      "created_at": "2026-07-31T14:22:10.000Z",
      "updated_at": "2026-07-31T14:22:10.000Z"
    }
  ]
  ```
* **Error Response (400 Bad Request)**:
  - Triggered if `project` parameter is missing.
  ```json
  {
    "error": "Bad Request",
    "message": "Missing required query parameter: project"
  }
  ```

---

## 2. Create Work Item

* **Endpoint**: `POST /api/work-items`
* **Request Headers**:
  - `Content-Type: application/json`
* **Request Body**:
  - `project` (string, required): The project ID key.
  - `title` (string, required): The freeform title (stripped and slugified on save).
  - `description` (string, required): Short description (max 100 characters).
  - `detailsText` (string, optional): Freeform markdown text for the brief.
  - `attachedFileName` (string, optional): Original name of selected file.
  - `attachedFileContent` (string, optional): Content of the selected file.
* **Success Response (200 OK)**:
  - Body:
  ```json
  {
    "workItem": {
      "id": "001",
      "title": "refund-flow-redesign",
      "description": "Lets users retry failed payments automatically",
      "state": "parked",
      "phase": "spec",
      "phase_group": "define",
      "work_item_type": "feature",
      "blocked_reason": null,
      "closed_reason": null,
      "assignee": null,
      "project": "my-project",
      "branch": null,
      "pr_url": null,
      "feature_brief_path": ".minna/features/001-refund-flow-redesign.md",
      "spec_path": null,
      "plan_path": null,
      "tasks_path": null,
      "created_at": "2026-07-31T14:22:10.000Z",
      "updated_at": "2026-07-31T14:22:10.000Z"
    }
  }
  ```
* **Error Response (400 Bad Request)**:
  - Triggered if description exceeds 100 characters, or title is empty.
  ```json
  {
    "error": "Bad Request",
    "message": "Description cannot exceed 100 characters."
  }
  ```

---

## 3. Update Work Item

* **Endpoint**: `PATCH /api/work-items/[id]`
* **Request Headers**:
  - `Content-Type: application/json`
* **Request Body**:
  - `project` (string, required): The project ID key.
  - `description` (string, required): Updated description (max 100 characters).
  - `detailsText` (string, optional): Updated freeform details text.
  - `attachedFileName` (string, optional): Name of new selected file.
  - `attachedFileContent` (string, optional): Content of the new selected file.
* **Success Response (200 OK)**:
  - Body:
  ```json
  {
    "workItem": {
      "id": "001",
      "title": "refund-flow-redesign",
      "description": "Lets users retry failed payments automatically",
      "state": "parked",
      "phase": "spec",
      "phase_group": "define",
      "work_item_type": "feature",
      "blocked_reason": null,
      "closed_reason": null,
      "assignee": null,
      "project": "my-project",
      "branch": null,
      "pr_url": null,
      "feature_brief_path": ".minna/features/001-refund-flow-redesign.md",
      "spec_path": null,
      "plan_path": null,
      "tasks_path": null,
      "created_at": "2026-07-31T14:22:10.000Z",
      "updated_at": "2026-07-31T14:35:00.000Z"
    }
  }
  ```
* **Error Response (404 Not Found)**:
  - Triggered if the work item with the given ID does not exist in the project database.
  ```json
  {
    "error": "Not Found",
    "message": "Work item with ID '001' not found."
  }
  ```
* **Error Response (400 Bad Request)**:
  - Triggered if description exceeds 100 characters.
  ```json
  {
    "error": "Bad Request",
    "message": "Description cannot exceed 100 characters."
  }
  ```

---

## 4. Drop Work Item

* **Endpoint**: `POST /api/work-items/[id]/drop`
* **Request Headers**:
  - `Content-Type: application/json`
* **Request Body**:
  - `project` (string, required): The project ID key.
* **Success Response (200 OK)**:
  - Body:
  ```json
  {
    "workItem": {
      "id": "001",
      "title": "refund-flow-redesign",
      "description": "Lets users retry failed payments automatically",
      "state": "closed",
      "phase": "spec",
      "phase_group": "define",
      "work_item_type": "feature",
      "blocked_reason": null,
      "closed_reason": "dropped",
      "assignee": null,
      "project": "my-project",
      "branch": null,
      "pr_url": null,
      "feature_brief_path": ".minna/features/001-refund-flow-redesign.md",
      "spec_path": null,
      "plan_path": null,
      "tasks_path": null,
      "created_at": "2026-07-31T14:22:10.000Z",
      "updated_at": "2026-07-31T14:38:22.000Z"
    }
  }
  ```
* **Error Response (404 Not Found)**:
  - Triggered if the work item with the given ID does not exist in the project database.
  ```json
  {
    "error": "Not Found",
    "message": "Work item with ID '001' not found."
  }
  ```
* **Error Response (400 Bad Request)**:
  - Triggered if trying to drop a work item that is already `closed`.
  ```json
  {
    "error": "Bad Request",
    "message": "Cannot drop work item in terminal state 'closed'."
  }
  ```

---

## 5. System & Edge Case Error Contracts

### A. Filesystem Write Permission Denied
* **Trigger**: Triggered if the application process does not have write permissions to write database files or brief markdown files (returns 500 Internal Server Error).
* **Response Body**:
  ```json
  {
    "error": "Internal Server Error",
    "message": "Filesystem write permission denied: unable to write brief file to '.minna/features/001-refund-flow-redesign.md'."
  }
  ```

### B. Corrupted Database File
* **Trigger**: Triggered if SQLite schema verification checks fail on initialization/connection (returns 500 Internal Server Error).
* **Response Body**:
  ```json
  {
    "error": "Internal Server Error",
    "message": "Database is corrupted: integrity verification check failed."
  }
  ```
