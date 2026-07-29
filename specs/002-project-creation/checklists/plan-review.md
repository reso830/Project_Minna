# Plan Review: Project Creation

**Gate result**: PASS. Reviewed: 2026-07-29.

Use this checklist to verify that the implementation plan aligns with the specification, architectural guidelines, and project constitution before writing any code.

- [x] **Scope Alignment**
  - [x] Does the plan cover the complete Add Project flow from UI trigger, folder picker, validation, database registry updates, to project loading?
  - [x] Are all spec-defined non-goals (e.g. no project deletion on disk, no remote syncing) respected?
  - [x] Does the plan limit CLI integration only to updating `last_opened_at` inside `~/.minna/projects.db` using database write locks?
  - [x] Does the plan remove legacy central resolution dead code (referencing `projects.yaml`) in `project-context.ts`?
  - [x] Does the plan scaffold the local project event database `.minna/minna.db` alongside the config files?
  - [x] Does the plan walk parent directories to resolve context and migrate legacy `minna.project.yaml` configs?
  - [x] Does the plan preserve the shipped verbatim `--project <key>` flag scoping behavior?

- [x] **Architecture Soundness & Locking**
  - [x] Is the separation of concerns respected (UI only triggers requests and handles response; Next.js APIs run node filesystem/dialog commands)?
  - [x] Is registry-write logic centralized in a shared backend utility to be reused by both Next.js APIs and the CLI?
  - [x] Is there robust error handling for OS-specific dialog picker commands (Darwin, Win32, Linux)?
  - [x] Does the database registry helper write using `BEGIN IMMEDIATE TRANSACTION` to prevent lost updates from concurrent CLI/web writes?
  - [x] Is Write-Ahead Logging (WAL) enabled on `~/.minna/projects.db` to avoid lock bottlenecks?

- [x] **Data-Model Risks**
  - [x] Does the ID collision handling logic append sequential suffixes (`-2`, `-3`, etc.) only if paths differ, and allow standard reopen flows if paths match?
  - [x] Does the scaffolding logic write exactly `version`, `created_at`, and `description: null`?
  - [x] Does the scaffolding logic run ONLY when the `.minna/` directory itself is absent?
  - [x] If a `.minna/` folder exists but lacks `config.yaml`, does the logic reject it immediately instead of auto-repairing or scaffolding?
  - [x] Does the project name preserve exact folder casing while the project ID uses slugified, lowercased characters?
  - [x] Is the registry stored at `~/.minna/projects.db` resolving cleanly on Windows/Mac/Linux?

- [x] **Contract Correctness**
  - [x] Does `/api/projects/pick` return absolute paths in standard JSON, handling cancellations with clear error codes?
  - [x] Does `/api/projects/add` accept `path` in request payload and return `400` with specific error details on validation failures?
  - [x] Does `/api/projects/open` handle switching of already registered project IDs, updating their `last_opened_at` timestamp?
  - [x] Does the error modal dialog in the UI bind correctly to `400 Bad Request` API error responses?

- [x] **Test Strategy**
  - [x] Are there unit tests planned for the registry database manager (transactions, CRUD, sorting, and collision handling)?
  - [x] Are there concurrency tests planned (testing concurrent read-modify-write transactions)?
  - [x] Are integration tests planned for the directory picker mock outcomes and scaffolding validation?
  - [x] Are UI unit tests planned for the Error Modal display and lock behavior?
  - [x] Are there test tasks checking that projects with zero features render correctly in the sidebar?
  - [x] Are there test tasks for detecting unavailable projects on disk and muting/disabling their sidebar rows?

- [x] **Constitution Compliance**
  - [x] Are there zero new runtime npm dependencies introduced?
  - [x] Is the schema validation centralized and shared across targets?
  - [x] Is the project registry backed by SQLite event journal (`~/.minna/projects.db`) to comply with Principle III and VI?

- [x] **Amendment Scope (Update/Delete/Health Check)**
  - [x] Are all new functional goals (Rename, Relocate, Remove, Load-time Health Checks) covered?
  - [x] Does relocation validation reject paths lacking a valid `.minna/config.yaml` using the validation Error Modal, without falling back to scaffolding?
  - [x] Is project removal registry-only, leaving disk files and work items untouched?
  - [x] Does list querying verify both directory existence and `.minna/config.yaml` schema validity before returning availability?
  - [x] Are `project.renamed`, `project.relocated`, and `project.removed` events written inside write transactions?
  - [x] Is the full registry event log exported to `~/.minna/registry-events.json` on transaction commit?
