# API Contract: Project Creation

This document outlines the REST API contracts between the frontend Next.js application and the Next.js server-side API routes for Feature 002 - Project Creation.

## Endpoints

### 1. List Projects

Get the array of all registered projects sorted by `last_opened_at` descending.

* **URL**: `/api/projects`
* **Method**: `GET`
* **Headers**:
  * `Content-Type: application/json`
* **Response (200 OK)**:
  - `name` preserves the exact folder casing on disk.
  - `id` is the slugified, lowercased version of `name`.
  - `available` indicates if the absolute path currently resolves on disk.
  ```json
  [
    {
      "id": "checkout-redesign",
      "name": "Checkout_Redesign",
      "path": "/home/user/projects/Checkout_Redesign",
      "last_opened_at": "2026-07-29T09:32:40.000Z",
      "available": true
    },
    {
      "id": "search-revamp",
      "name": "Search-Revamp",
      "path": "/home/user/projects/Search-Revamp",
      "last_opened_at": "2026-07-28T14:10:00.000Z",
      "available": false
    }
  ]
  ```

---

### 2. Trigger Native Directory Picker

Spawns the platform-specific OS directory dialog. Blocks until user selects a directory or cancels.

* **URL**: `/api/projects/pick`
* **Method**: `POST`
* **Headers**:
  * `Content-Type: application/json`
* **Response (200 OK)**:
  ```json
  {
    "path": "/home/user/projects/New_Project"
  }
  ```
* **Response (400 Bad Request)**:
  Returned if the picker dialog was cancelled or dismissed without choosing a folder.
  ```json
  {
    "error": "Directory picker was cancelled by the user."
  }
  ```
* **Response (500 Internal Server Error)**:
  Returned if directory picker failed to execute due to system errors.
  ```json
  {
    "error": "Failed to launch native OS directory picker: <reason>"
  }
  ```

---

### 3. Add Project

Validates, scaffolds (if necessary), and registers a selected path in the global project database registry.

* **URL**: `/api/projects/add`
* **Method**: `POST`
* **Headers**:
  * `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "path": "/home/user/projects/New_Project"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "project": {
      "id": "new-project",
      "name": "New_Project",
      "path": "/home/user/projects/New_Project",
      "last_opened_at": "2026-07-29T09:32:40.000Z"
    }
  }
  ```
* **Response (400 Bad Request)**:
  Returned if the chosen folder contains an existing `.minna` directory but `.minna/config.yaml` is missing or contains invalid YAML syntax.
  ```json
  {
    "error": "Validation Failure",
    "details": "The directory contains a '.minna' folder but '.minna/config.yaml' is missing or unparseable. Auto-repair is disabled."
  }
  ```
* **Response (500 Internal Server Error)**:
  Returned if the server cannot read/write files due to lack of filesystem permissions or database write locks.
  ```json
  {
    "error": "Internal Server Error",
    "details": "Permission denied writing to /home/user/projects/New_Project/.minna/config.yaml"
  }
  ```

---

### 4. Switch / Open Project

Switches context to an already registered project. Updates its `last_opened_at` timestamp.

* **URL**: `/api/projects/open`
* **Method**: `POST`
* **Headers**:
  * `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "id": "checkout-redesign"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "project": {
      "id": "checkout-redesign",
      "name": "Checkout_Redesign",
      "path": "/home/user/projects/Checkout_Redesign",
      "last_opened_at": "2026-07-29T10:20:00.000Z"
    }
  }
  ```
* **Response (404 Not Found)**:
  Returned if the project `id` is not registered in the database.
  ```json
  {
    "error": "Not Found",
    "details": "No project registered with ID 'checkout-redesign'."
  }
  ```
* **Response (410 Gone)**:
  Returned if the registered project's path no longer resolves on disk.
  ```json
  {
    "error": "Project Unavailable",
    "details": "The project path '/home/user/projects/Checkout_Redesign' no longer exists."
  }
  ```
