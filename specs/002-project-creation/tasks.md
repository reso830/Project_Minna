# Tasks: Project Creation

## Conventions Header

- **Status Legend**: `[x]` done · `[ ]` pending · `[~]` skipped
- **Parallel Execution**: Tasks marked `[P]` can run in parallel (different files, no shared edits)
- **Phase Dependency**: `01 → 02 → 03 → 04 → 05 → 06 → 07`
- **Verification Commands**:
  - `npm run test` (compiles and runs CLI/unit/UI tests)
  - `npm run dev` (spins up Next.js server for manual check)

### Phase Summary Table

| Phase | Focus/Name | Task ID Range | User Stories Covered |
|---|---|---|---|
| **01** | Setup & Infrastructure | `T001–T002` | — |
| **02** | Foundational Prerequisites | `T003–T006` | — |
| **03** | Onboarding & Picker UI | `T007–T011` | US1, US2 |
| **04** | Rejection & Error Modal | `T012–T013` | US3 |
| **05** | ID Collisions & CLI Sync | `T014–T017` | US4, US5 |
| **06** | Release Prep | `T018–T021` | — |
| **07** | Browser Smoke Test | `T022` | US1, US2, US3, US4, US5 |

---

## Phase 01: Setup (Shared Infrastructure)

**Purpose**: Setup type definitions, API file endpoints, and directory mapping structures.

- [x] **T001** **Type Definitions Expansion**
  * **Target Files**: [src/core/types.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts)
  * **Expected Behavior**: Define TypeScript interfaces for `ProjectRegistryEntry` and `ProjectRegistry` to represent database elements in `~/.minna/projects.db`. Include `available?: boolean` and ensure casing parameters (`name` preserving casing, `id` slugified/lowercased).
  * **Constraints**: Must not break existing CLI configurations.
  * **Validation/Test Location**: Run `npm run build:cli` to verify compilation.

- [x] **T002** [P] **API Endpoint Skeleton Construction**
  * **Target Files**:
    - `src/app/api/projects/route.ts` (New file)
    - `src/app/api/projects/pick/route.ts` (New file)
    - `src/app/api/projects/add/route.ts` (New file)
    - `src/app/api/projects/open/route.ts` (New file)
  * **Expected Behavior**: Stub out the API route files returning simple `{ status: "ok" }` payloads to prepare the routing pipeline.
  * **Constraints**: Follow Next.js App Router API standards.
  * **Validation/Test Location**: Navigate to `http://localhost:3000/api/projects` in dev mode and assert server returns correct JSON.

---

## Phase 02: Foundational (Blocking Prerequisites)

**Purpose**: Build transactional database registry, project configuration, scaffolding, and validation helpers.
* **⚠️ CRITICAL**: No user story UI implementation can begin until this phase is complete.

- [x] **T003** **Central Registry SQLite Wrapper**
  * **Target File**: `src/core/registry.ts` (New file)
  * **Expected Behavior**: Implement helper functions to read, parse, and write to SQLite database `~/.minna/projects.db`. Setup the `events` table (for append-only event journals) and the `projects` projection table. Ensure write transactions use `BEGIN IMMEDIATE TRANSACTION` to prevent concurrent write races. Automatically write the exported read-only `~/.minna/projects.json` on commit.
  * **Constraints**: Configure the database with WAL mode (`PRAGMA journal_mode = WAL`) on initialization.
  * **Validation/Test Location**: Tested in T004.

- [x] **T004** **Central Registry Core & Concurrency Tests**
  * **Target File**: `src/core/registry.test.ts` (New file)
  * **Expected Behavior**:
    - Assert database creation, event appending, and projection updating occur in the same transaction.
    - Assert name casing rules are respected (preserved folder casing in `name`, slugified/lowercased in `id`).
    - Assert that query retrieval lists projects sorted by `last_opened_at` descending.
    - Write a concurrency test simulating multiple read-modify-write operations across different process connections, verifying that `BEGIN IMMEDIATE` queuing resolves correctly without lost updates or corruption.
  * **Validation/Test Location**: Run `npm run test` and assert registry unit tests pass.

- [x] **T005** **Project Configuration Scaffolding & Validation**
  * **Target File**: `src/core/registry.ts` (New file)
  * **Expected Behavior**: Implement functions to:
    - Scaffold `.minna/config.yaml` with exactly `version: 1`, current ISO timestamp, and `description: null` ONLY when the `.minna/` directory itself is entirely absent. Do NOT write `speckit_dir`, `github`, or `default_branch` on this fresh-scaffold path — those keys are written only when migrating a pre-existing `minna.project.yaml` (see T015b); a brand-new project has no legacy values to preserve and the brief defines the initial file as exactly these 3 keys.
    - Scaffold and initialize `.minna/minna.db` local project event database using node sqlite database sync structures (from [db.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/db.ts)) alongside the config.yaml.
    - Validate `.minna/config.yaml` schema if present (ensuring version and created_at are present). Reject on validation error (YAML parse error, missing fields, or missing `config.yaml` in an already existing `.minna/` directory) immediately without attempting auto-repair.
    - **Lazy DB Checks**: If `.minna/config.yaml` exists and is valid but `.minna/minna.db` is missing, initialize the database dynamically on project open/access.
  * **Constraints**: Enforce date validation checking that `created_at` complies with ISO 8601 timestamp formats.
  * **Validation/Test Location**: Tested in T006.

- [x] **T006** **Project Config & Validation Tests**
  * **Target File**: `src/core/registry.test.ts`
  * **Expected Behavior**:
    - Write tests verifying that scaffolding runs on a clean folder (missing `.minna/`) and creates both `config.yaml` and `minna.db` event databases. Assert the fresh-scaffold `config.yaml` contains exactly `version`, `created_at`, and `description` — no `speckit_dir`, `github`, or `default_branch` keys.
    - Write tests verifying that validation rejects an existing `.minna/` folder if `config.yaml` is missing or corrupt (no/invalid config.yaml branch checks).
    - Write tests verifying the **Lazy Database Initialization** path: opening a project containing `config.yaml` but missing `minna.db` successfully creates and initializes `minna.db`.
    - Assert validation rejects invalid ISO 8601 dates and enforces required fields.
  * **Validation/Test Location**: Run `npm run test` and assert all tests pass.

---

## Phase 03: Onboarding & Picker UI (Priority: P1)

**Goal**: Implement the frontend selection flows and backend folder picking endpoints.
* **Independent Test**: Clicking the Sidebar "+" button launches the OS folder picker, creates a project, and lists it in the sidebar.

- [x] **T007** **Server OS Folder Picker Implementation**
  * **Target File**: `src/app/api/projects/pick/route.ts`
  * **Expected Behavior**: Implement directory picker executing platform-specific commands (AppleScript on macOS, PowerShell dialog on Windows, Zenity on Linux) to capture and return the chosen absolute directory path.
  * **Constraints**: Do not introduce new npm dependencies. Handle user cancellations gracefully by returning a clean error.
  * **Validation/Test Location**: Manual verification using postman or curl.

- [x] **T008** **Project List & Add Endpoints Integration**
  * **Target Files**:
    - `src/app/api/projects/route.ts`
    - `src/app/api/projects/add/route.ts`
  * **Expected Behavior**:
    - `/api/projects` endpoint returns the registered projects sorted by `last_opened_at` descending. Include an `available` field by checking filesystem existence for each path on disk.
    - `/api/projects/add` validates the selected directory, scaffolds configuration and SQLite database if needed, adds the entry to the database registry, and returns the project details.
  * **Validation/Test Location**: Tested in T011.

- [x] **T009** **Sidebar Integration for Recent Projects**
  * **Target Files**:
    - `src/components/Sidebar.tsx`
    - `src/components/WorkspaceProvider.tsx`
  * **Expected Behavior**:
    - Load the registered project list from `/api/projects` inside the workspace provider on load.
    - Render sidebar projects directly from the provider's projects array (independent of features list, allowing empty projects with zero features to render empty sublists).
    - Add a path resolution availability check: if a project returns `available: false`, render its sidebar row in a muted, disabled "unavailable" visual style, and block click-to-open events.
  * **Validation/Test Location**: Run `npm run dev` and check sidebar renders projects correctly.

- [x] **T010** **Sidebar Add & Switch Button Integration**
  * **Target Files**:
    - `src/components/Sidebar.tsx`
    - `src/components/WorkspaceProvider.tsx`
  * **Expected Behavior**:
    - Bind the "+" button next to the Projects heading to trigger the picker API, then chain to the add project API, updating state and setting the new project as active.
    - Bind project row click events to call `POST /api/projects/open` passing the project `id`, updating the `last_opened_at` timestamp in the database, updating workspace state, and sorting the sidebar list.
  * **Validation/Test Location**: Select "+", verify the picker opens, choose a directory, and assert the sidebar updates. Click an existing project to verify it switches and updates ordering.

- [x] **T011** **Picker, Add & Open Endpoints Integration Tests**
  * **Target Files**: `src/app/api/__tests__/projects.test.ts` (New file)
  * **Expected Behavior**: Write unit/integration tests for server endpoints mocking standard picker shell commands and asserting project additions, scaffolding (including local DB creation), switching, and 404/410 errors on missing paths.
  * **Validation/Test Location**: Run `npm run test:ui` (or `npm run test`) and assert API tests pass.

---

## Phase 04: Rejection & Error Modal (Priority: P1)

**Goal**: Implement error dialogs to intercept and display project initialization or validation failures.
* **Independent Test**: Selecting a directory with missing or corrupted configs blocks interactions and renders an error modal.

- [x] **T012** **Dedicated Validation Error Modal**
  * **Target Files**:
    - `src/components/ErrorModal.tsx` (New file)
    - `src/components/WorkspaceProvider.tsx`
  * **Expected Behavior**: Build a high-priority modal popup when project validation returns a `400 Bad Request` state, blocking background interactions, showing the specific rejection message, and unlocking the UI on dismiss.
  * **Constraints**: Use clean layout and CSS styling matching the design colors.
  * **Validation/Test Location**: Tested in T013.

- [x] **T013** **Error Modal UI Tests**
  * **Target File**: `src/components/__tests__/ErrorModal.test.tsx` (New file)
  * **Expected Behavior**: Write Jest/React Testing Library tests confirming that the modal mounts on validation failure, renders details correctly, locks background clicks, and closes on clicking the dismiss button.
  * **Validation/Test Location**: Run `npm run test:ui` and verify all tests pass.

---

## Phase 05: ID Collisions & CLI Sync (Priority: P2)

**Goal**: Resolve naming conflicts in the registry and integrate CLI command runs to update the opened timestamp.
* **Independent Test**: Registering two folders named `alpha` results in registry IDs `alpha` and `alpha-2`. Running `cli.ts status` inside `alpha` updates its `last_opened_at` timestamp.

- [x] **T014** **Registry ID Collision Resolution**
  * **Target File**: `src/core/registry.ts`
  * **Expected Behavior**: Enhance registry write helpers to generate slugified folder names. If a matching ID exists for a different path, append `-2`, `-3` etc. until unique. If the path matches an existing ID, reuse it (standard re-open flow).
  * **Validation/Test Location**: Unit tests in `src/core/registry.test.ts`.

- [x] **T015a** **CLI Context Search & Traversal Walk**
  * **Target Files**:
    - `src/core/project-context.ts`
  * **Expected Behavior**: Update `resolveProjectContext` in `project-context.ts` to walk upwards from the current directory through parent directory chains to locate `.minna/config.yaml` or legacy `minna.project.yaml`.
  * **Validation/Test Location**: Tested in T017.

- [x] **T015b** **CLI Legacy Configuration Migration**
  * **Target Files**:
    - `src/core/project-context.ts`
  * **Expected Behavior**: Read legacy fields (`speckit_dir`, `github`, `default_branch`) from `minna.project.yaml` and backfill `created_at` timestamp (via `birthtime` of `minna.project.yaml`, git log, or current date) to write the new `.minna/config.yaml` schema, and rename/delete the legacy file. `speckit_dir`/`github`/`default_branch` appear in `.minna/config.yaml` **only** as output of this migration path — T005's fresh-scaffold path never writes them.
  * **Validation/Test Location**: Tested in T017.

- [x] **T016** **project-context.ts Dead Resolution Cleanup**
  * **Target File**: [src/core/project-context.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/project-context.ts)
  * **Expected Behavior**: Delete dead references to `projects.yaml` and remove the unused `resolveCentralProject` and `CENTRAL_PROJECTS_FILE` code structures.
  * **Validation/Test Location**: Compiles cleanly via `npm run build:cli`.

- [x] **T017** **CLI Registry Sync & Verbatim Project Flag Verification**
  * **Target Files**:
    - `src/core/project-context.test.ts`
    - `src/core/project-context.ts`
  * **Expected Behavior**:
    - Implement CLI context registry sync resolving project paths and registering/updating entries inside `~/.minna/projects.db` using database transactions on command run.
    - Preserve the shipped verbatim `--project <key>` flag behavior: allow arbitrary key labels without throwing database validation `Unknown project` blocks.
    - Update CLI context tests to verify parent-chain traversal search resolutions, legacy config migration/rename and backfill data checks, database registration syncs, and verbatim flag bypasses.
  * **Validation/Test Location**: Run `npm run test` and verify CLI context tests pass.

---

## Phase 06: Release Prep

**Purpose**: Execute final packaging tasks, version bumps, and documentation reviews.

- [x] **T018** **Version Bump Revision**
  * **Target Files**:
    - [package.json](file:///D:/Alvin/_CodeProjects/Project_Minna/package.json)
    - `package-lock.json`
  * **Expected Behavior**: Bump package.json and lockfile revision versions to `0.4.0` (reflecting new project management structures).
  * **Validation/Test Location**: Verify package file format integrity.

- [x] **T019** **Changelog Update**
  * **Target File**: `CHANGELOG.md`
  * **Expected Behavior**: Record new feature releases, including native directory picking API, validation error modal, database-backed registry, casing rules, and CLI registry synchronization.
  * **Validation/Test Location**: Verify formatting.

- [x] **T020** **Roadmap Indexing**
  * **Target File**: [docs/feature_roadmap.md](file:///D:/Alvin/_CodeProjects/Project_Minna/docs/feature_roadmap.md)
  * **Expected Behavior**: Update status row for `002-project-creation` as Completed and specify the target version `0.4.0`.
  * **Validation/Test Location**: Confirm Markdown table renders.

- [x] **T021** **Documentation Alignment**
  * **Target Files**:
    - `README.md`
    - `docs/REPO_MAP.md` (Create if missing)
  * **Expected Behavior**: Update README with UI and CLI registry database instructions. Re-align repo maps for new registry utility and API endpoints files.
  * **Validation/Test Location**: Verify formatting.

---

## Phase 07: Browser Smoke Test

**Purpose**: Execute manual browser checks against the final release build.

- [ ] **T022** **E2E Browser Verification**
  * **Target Component**: Whole application workspace
  * **Expected Behavior**: Build project (`npm run build`), run development mode (`npm run dev`), open the browser, and verify:
    1. Click sidebar "+" button, pick folder, and assert it scaffolds configuration and lists correctly. Check that `.minna/minna.db` local event database gets initialized correctly.
    2. Add project with existing `.minna` directory and verify it imports without file overrides. Verify lazy DB creation works if `minna.db` was deleted before open.
    3. Choose directory with corrupt/missing configurations and verify the validation error modal shows up and locks interactions (compare visually against design reference at [error_modal_mockup.jpg](file:///D:/Alvin/_CodeProjects/Project_Minna/specs/002-project-creation/design/error_modal_mockup.jpg)).
    4. Register two distinct folders with same name and check that `~/.minna/projects.db` yields unique suffixed IDs, preserving casing for names and lowercasing slugs for IDs.
    5. Check that projects with zero features render empty sublists in the sidebar correctly (compare visually against design reference at [sidebar_project_states_mockup.jpg](file:///D:/Alvin/_CodeProjects/Project_Minna/specs/002-project-creation/design/sidebar_project_states_mockup.jpg)).
    6. Mock an unavailable directory path, refresh browser, and verify the project displays as muted/disabled.
    7. Run CLI status command inside project folder and assert `last_opened_at` changes in `~/.minna/projects.db`.
  * **Validation/Test Location**: Assert all Independent Tests for US1, US2, US3, US4, and US5 pass.
