# Tasks: Project Creation & Management

## Conventions Header

- **Status Legend**: `[x]` done · `[ ]` pending · `[~]` skipped
- **Parallel Execution**: Tasks marked `[P]` can run in parallel (different files, no shared edits)
- **Phase Dependency**: `01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10`
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
| **06** | Release Prep (Initial) | `T018–T021` | — |
| **07** | Initial Smoke Test | `T022` | US1, US2, US3, US4, US5 |
| **08** | Project Management Core Backend | `T023–T027` | US6, US7, US8 |
| **09** | Project Management UI & Modals | `T028–T032` | US6, US7, US8 |
| **10** | E2E Amendment Smoke Test & Release | `T033–T034` | US6, US7, US8 |

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

## Phase 06: Release Prep (Initial)

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

## Phase 07: Initial Smoke Test

**Purpose**: Execute manual browser checks against the initial release build.

- [x] **T022** **E2E Browser Verification**
  * **Target Component**: Whole application workspace
  * **Expected Behavior**: Build project (`npm run build`), run development mode (`npm run dev`), open the browser, and verify:
    1. Click sidebar "+" button, pick folder, and assert it scaffolds configuration and lists correctly. Check that `.minna/minna.db` local event database gets initialized correctly.
    2. Add project with existing `.minna` directory and verify it imports without file overrides. Verify lazy DB creation works if `minna.db` was deleted before open.
    3. Choose directory with corrupt/missing configurations and verify the validation error modal shows up and locks interactions.
    4. Register two distinct folders with same name and check that `~/.minna/projects.db` yields unique suffixed IDs, preserving casing for names and lowercasing slugs for IDs.
    5. Check that projects with zero features render empty sublists in the sidebar correctly.
    6. Mock an unavailable directory path, refresh browser, and verify the project displays as muted/disabled.
    7. Run CLI status command inside project folder and assert `last_opened_at` changes in `~/.minna/projects.db`.

---

## Phase 08: Project Management Core Backend (Priority: P1)

**Purpose**: Build the database update, relocation, and deletion functions in the backend registry, along with ongoing health check query validations.

- [ ] **T023** **Update and Remove SQLite Registry Actions**
  * **Target File**: `src/core/registry.ts`
  * **Expected Behavior**: Implement `updateProject(id, name, path)` and `removeProject(id)` in database transactions using `BEGIN IMMEDIATE TRANSACTION`.
    - `updateProject` validates that the new `path` is not already registered under another project ID (relocate collision validation). If it is already registered, throws an error (relocation collision) to be returned as `400 Bad Request`.
    - `updateProject` records event type `project.renamed` (if name changed) and/or `project.relocated` (if path changed) in the `events` table (payload: `{"id", "name", "path"}`), and updates current projection columns.
    - `removeProject` deletes the projection row matching the `id` from the `projects` table and records event type `project.removed` (payload: exactly `{"id"}`).
    - Automatically exports current projects projection to `~/.minna/projects.json` and registry events history to `~/.minna/registry-events.json` on write.
  * **Constraints**: Ensure the project `id` is treated as immutable and is never changed during updates.

- [ ] **T024** **Unified Ongoing Project Health Checks & Lazy Repairs**
  * **Target Files**:
    - `src/core/registry.ts`
  * **Expected Behavior**: Export a unified helper `verifyProjectHealth(projectPath): { available: boolean; error?: string }` in `registry.ts` checking folder existence and `.minna/config.yaml` schema validity (does not mutate disk files or check `minna.db` presence, since database is lazily created on open).
  * **Constraints**:
    - All path checking inside Next.js APIs (e.g. `route.ts`, `open/route.ts`) and CLI context startup must use this single helper, eliminating duplicate inline checks.
    - Update `POST /api/projects/open` and CLI context startup to invoke `prepareProject(projectPath)` to handle lazy SQLite database recreation on open (self-healing missing `minna.db` files).

- [ ] **T025** **Registry Management Unit Tests**
  * **Target File**: `src/core/registry.test.ts`
  * **Expected Behavior**: Write unit tests for the new database operations:
    - Assert `updateProject` transactionally records renamed/relocated events and updates current projection columns while keeping `id` identical.
    - Assert `updateProject` rejects relocation to an already-registered path, throwing validation errors.
    - Assert `removeProject` deletes projects from projections and records `project.removed` events, leaving the folder and files on disk untouched.
    - Assert ongoing health checks return `available: false` if a project path is deleted, config.yaml is deleted, or config.yaml is modified to contain invalid YAML or invalid timestamps.
    - Assert that opening a project with missing `.minna/minna.db` successfully triggers lazy database table creation.
  * **Validation/Test Location**: Run `npm run test` to verify unit tests pass.

- [ ] **T026** **Update & Remove API Integration Endpoints**
  * **Target Files**:
    - `src/app/api/projects/edit/route.ts` (New file)
    - `src/app/api/projects/remove/route.ts` (New file)
  * **Expected Behavior**:
    - `/api/projects/edit` accepts `{ id, name, path }`, immediately executes configuration health validations at the relocated `path` (aborting and returning `400` validation errors with Error Modal signals if missing/invalid, or if the path is already registered under another project), and updates the registry.
    - `/api/projects/remove` accepts `{ id }` and deregisters the project.
  * **Validation/Test Location**: Tested in T027.

- [ ] **T027** **API Management Endpoint Tests**
  * **Target File**: `src/app/api/projects/__tests__/projects.test.ts`
  * **Expected Behavior**: Write integration tests for new endpoints, verifying relocation validation error branches, duplicate path relocations rejection, and clean deregistrations.
  * **Validation/Test Location**: Run `npm run test:ui` (or `npm run test`) to verify.

---

## Phase 09: Project Management UI & Modals (Priority: P1)

**Goal**: Implement the popovers, action choices, and double confirm overlays matching the project management design reference layouts.

- [ ] **T028** **Project Ellipsis Hover Menu & Popover**
  * **Target Files**:
    - `src/components/Sidebar.tsx`
  * **Expected Behavior**: Render an actions menu button (Feather-style ellipsis `icon-ellipsis` or vertical/horizontal ellipsis) on project row mouse hover. Clicking it displays a popover menu anchored to the ellipsis with options **Edit Project** and **Remove Project**. Clicking outside dismisses the popover.
  * **Constraints**: Keep popovers properly aligned.

- [ ] **T029** **Edit Project Modal Component**
  * **Target File**: `src/components/EditProjectModal.tsx` (New file)
  * **Expected Behavior**: Create the Edit Project modal dialog in the light card style.
    - Title: "Edit Project".
    - Rename text input prefilled with current display name.
    - Read-only current path display, alongside a "Select project directory" picker button that launches the folder picker API. Relocating immediately validates the path, showing the Error Modal if invalid or already registered.
    - Red left-aligned "Remove Project" button.
    - Save button, disabled until name or folder differs from saved values.
    - Cancel button. If changes exist, triggers the Discard changes modal.

- [ ] **T030** **Remove Confirm Modal Component**
  * **Target File**: `src/components/RemoveConfirmModal.tsx` (New file)
  * **Expected Behavior**: Create the Remove Project confirmation overlay in the light card style.
    - Title: "Remove '{project name}'?".
    - Warning text: "This removes the project from Minna. Your project files on disk won't be affected." (Do not use prototype's destructive copy).
    - Footer CTAs: Cancel, Remove Project (red, destructive).

- [ ] **T031a** **Discard changes Confirm Modal Component**
  * **Target File**: `src/components/DiscardConfirmModal.tsx` (New file)
  * **Expected Behavior**: Create the Discard changes confirmation overlay.
    - Title: "Discard changes?".
    - Prompt: "You have unsaved changes. Are you sure you want to discard them?".
    - Footer CTAs: Keep Editing, Discard.

- [ ] **T031b** **UI Component Unit Tests**
  * **Target Files**:
    - `src/components/__tests__/EditProjectModal.test.tsx` (New file)
  * **Expected Behavior**: Write unit/integration tests verifying the actions menu popover triggers (dismiss-on-outside-click), the Edit Modal form layout (Save button disabled status, picker callback validation), Discard confirm triggers, and Remove modal confirmation buttons.

- [ ] **T032** **UI Modals Orchestration & Provider Integration**
  * **Target Files**:
    - `src/components/Sidebar.tsx`
    - `src/components/WorkspaceProvider.tsx`
  * **Expected Behavior**: Wire the open, edit, remove, save, cancel, and double confirmation modals triggers in the provider context state, displaying overlays, locking background clicks, and reloading workspace context correctly.
  * **Validation/Test Location**: Run `npm run dev` and manual review.

---

## Phase 10: E2E Amendment Smoke Test & Release

**Purpose**: Execute final manual smoke tests on the update/delete amendment features, update changelogs, and bump roadmap status.

- [ ] **T033** **E2E Project Management Verification**
  * **Target Component**: Whole application workspace
  * **Expected Behavior**: Run development mode and manually verify:
    1. Hover row, select Edit Project from actions menu, edit name, click Save, and check display name changes in the sidebar.
    2. Click Select project directory in Edit Modal, choose a valid relocated directory, Save, and verify path changes. Relocate to an invalid folder and verify the Error Modal appears and aborts saving. Relocate to an already-registered path and verify the duplicate path Error Modal appears and aborts.
    3. Click Cancel with dirty changes, verify Discard changes modal is displayed, click Discard, and verify modal closes and registry remains unchanged.
    4. Click Remove Project, verify confirmation warning is shown, confirm, and verify project disappears from the sidebar. Verify the folder and files on disk are completely untouched. If removing the currently active project, verify that the active project context is updated to `null` (unselected) and the UI renders the empty screen/default dashboard state.
    5. Delete `config.yaml` from a registered project on disk, reload, and verify the project displays as muted/unavailable in the sidebar. Delete `minna.db` from a healthy project on disk, reload, verify it displays as available in the sidebar, open it, and verify that `minna.db` self-heals by initializing database tables.
    6. Check that all mutations write events to `registry-events.json` in the home `.minna` directory.

- [ ] **T034** **Changelog and Roadmap Bump**
  * **Target Files**:
    - `CHANGELOG.md`
    - `docs/feature_roadmap.md`
    - [package.json](file:///D:/Alvin/_CodeProjects/Project_Minna/package.json)
    - `package-lock.json`
    - `docs/minna-project-registry.md`
    - `specs/002-project-creation/quickstart.md`
  * **Expected Behavior**: Record amendment releases in CHANGELOG, update Feature 002 roadmap status in `docs/feature_roadmap.md` to `Completed` for release `0.5.0`, update registry documentation in `docs/minna-project-registry.md` to reflect edit/remove events, update `quickstart.md` to describe Project Management operations, and bump version to `0.5.0` in package.json/package-lock.json.
