# Tasks: Work Item Management

**Input**: Design documents from [specs/003-work-item-management/](file:///D:/Alvin/_CodeProjects/Project_Minna/specs/003-work-item-management/)
**Prerequisites**: [plan.md](file:///D:/Alvin/_CodeProjects/Project_Minna/specs/003-work-item-management/plan.md) (required), [spec.md](file:///D:/Alvin/_CodeProjects/Project_Minna/specs/003-work-item-management/spec.md) (required)

## Conventions Header

- **Status Legend**: `[x]` done · `[ ]` pending · `[~]` skipped
- **Parallel Execution**: Tasks marked `[P]` can run in parallel (different files, no shared edits)
- **Phase Dependency**: `01 → 02 → 03 → 04 → 05 → 06 → 07`
- **Verification Commands**:
  - `npm run test` (compiles and runs unit and integration tests)
  - `npm run dev` (starts development Next.js server for manual check)
  - `npm run lint` (runs ESLint checks)

### Phase Summary Table

| Phase | Focus/Name | Task ID Range | User Stories Covered |
|---|---|---|---|
| **01** | Setup & Infrastructure | `T001–T002` | — |
| **02** | Foundational Prerequisites | `T003–T007` | — |
| **03** | Work Item CRUD Backend & API | `T008–T011` | US1, US2, US3 |
| **04** | Drop Work Item Backend & API | `T012–T013` | US4 |
| **05** | Sidebar & Details UI | `T014–T019` | US1, US2, US3, US4 |
| **06** | Release Prep | `T020–T023` | — |
| **07** | Browser Smoke Test | `T024` | US1, US2, US3, US4 |

---

## Phase 01: Setup (Shared Infrastructure)

**Purpose**: Initialize model type definitions and prepare the Next.js API route directory structure.

- [x] T001 Expand type definitions in src/core/types.ts
  * **Target Files**: [src/core/types.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts)
  * **Expected Behavior**: Update `WorkItem` type in `types.ts` to add v3 state model fields: `closed_reason`, `feature_brief_path`, `spec_path`, `plan_path`, and `tasks_path` as nullable optional strings. Ensure `Phase` type uses the canonical `"spec-review"` instead of `"requirements-review"`.
  * **Constraints**: Must not break existing project-creation schemas or types.
  * **Validation/Test Location**: Run `npm run build:cli` to verify compilation.
  * **Out-of-Scope**: Database model file updates.

- [x] T002 [P] Construct Next.js API route skeletons in src/app/api/work-items
  * **Target Files**:
    - `src/app/api/work-items/route.ts` (New file)
    - `src/app/api/work-items/[id]/route.ts` (New file)
    - `src/app/api/work-items/[id]/drop/route.ts` (New file)
  * **Expected Behavior**: Stub out the API route files returning simple `{ status: "ok" }` payloads to prepare the routing pipeline.
  * **Constraints**: Follow Next.js App Router API standards.
  * **Validation/Test Location**: Navigate to `http://localhost:3000/api/work-items` in dev mode and assert server returns correct JSON.

---

## Phase 02: Foundational (Blocking Prerequisites)

**Purpose**: Build the database schema migrations and the repository pattern to handle local SQLite storage.
* **⚠️ CRITICAL**: No user story UI implementation can begin until this phase is complete.

- [x] T003 Define Repository interfaces in src/core/repositories/types.ts
  * **Target Files**: `src/core/repositories/types.ts` (New file)
  * **Expected Behavior**: Define `IWorkItemsRepository` and `IEventsRepository` interfaces, outlining signatures for creating features, fetching active lists, appending events, and reading events. The description-update signature and implementation are intentionally deferred to T009 (Phase 03), where its event-backed mutation behavior is introduced.
  * **Constraints**: Exclude UI or REST API dependencies. Supabase integration is deferred.
  * **Validation/Test Location**: Checked during CLI build.

- [x] T004 Implement SQLite repository classes in src/core/repositories/sqlite.ts
  * **Target Files**: `src/core/repositories/sqlite.ts` (New file)
  * **Expected Behavior**: Implement `SqliteWorkItemsRepository` and `SqliteEventsRepository` executing operations against local SQLite database connections using Node's `DatabaseSync` helper.
  * **Constraints**: Ensure write mutations occur inside database transactions.
  * **Validation/Test Location**: Tested in T007.

- [x] T005 [P] Create repository factory export in src/core/repositories/factory.ts
  * **Target Files**: `src/core/repositories/factory.ts` (New file)
  * **Expected Behavior**: Export `createRepositories(config)` function that instantiates the SQLite concrete repository wrapper for the project's config directory.
  * **Constraints**: Do not import or bundle any external network databases like Supabase client libraries (Constitution XVI compliance).
  * **Validation/Test Location**: Tested in T007.

- [x] T006 Implement database migrations in src/core/db.ts
  * **Target Files**: [src/core/db.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/db.ts)
  * **Expected Behavior**:
    - Update the initial `work_items` table schema query to include columns: `closed_reason`, `feature_brief_path`, `spec_path`, `plan_path`, and `tasks_path`.
    - Update the initial `events` table schema query to include the `project` column.
    - Implement a migration function `migrateWorkItemsColumns(db)` that queries the `work_items` table schema info and executes `ALTER TABLE` to dynamically add missing columns to pre-existing databases. Description limits (100 characters max) are validated strictly at the core service / API level rather than retrofit database constraints.
    - Update `initDb` to accept a `projectKey` parameter: `initDb(dbPath, projectKey?: string)`.
    - Implement a migration function `migrateEventsProjectColumn(db, projectKey?: string)` that:
      1. Performs `ALTER TABLE events ADD COLUMN project TEXT;` if the column is missing.
      2. Executes a backfill query copying the project name from `work_items` based on `work_item_id` (`UPDATE events SET project = (SELECT project FROM work_items WHERE work_items.id = events.work_item_id) WHERE work_item_id IS NOT NULL;`).
      3. For any remaining system/git events with no `work_item_id`, backfills the value using the passed `projectKey` query parameter. If `projectKey` is omitted, slugifies the parent directory name of `.minna` extracted from the database file path (`dbPath`) and backfills that value (`UPDATE events SET project = ? WHERE project IS NULL;`).
  * **Constraints**: Must not drop or corrupt existing user tables or data. Must run cleanly against non-empty databases.
  * **Validation/Test Location**: Tested in T007.

- [x] T007 Write repository and migration unit tests in src/core/__tests__/repositories.test.ts
  * **Target Files**: `src/core/__tests__/repositories.test.ts` (New file)
  * **Expected Behavior**:
    - Verify that database schema migrations execute successfully on an older version SQLite file, adding missing columns to both `work_items` and `events` tables and backfilling null projects without data loss.
    - Verify that SQLite repositories query and write correct records, handling sequential project-scoped 3-digit IDs and digit expansions above `999` (e.g. `1000`).
  * **Validation/Test Location**: Run `npm run build:cli && node --test dist/core/__tests__/repositories.test.js` and assert all unit tests pass.

---

## Phase 03: Work Item CRUD Backend & API (Priority: P1)

**Goal**: Implement backend API routes and CLI handlers to create, read, and update work items.
* **Independent Test**: Invoking the POST API or CLI command registers a work item, slugifies its title, generates a 3-digit ID, and saves its details brief to a local markdown file.

- [x] T008 [US1] [US2] Implement createWorkItem core function with atomic recovery in src/core/work-items.ts
  * **Target Files**: [src/core/work-items.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/work-items.ts)
  * **Expected Behavior**: Encapsulate all feature creation logic inside the core database module:
    - Slugify the title and discard the freeform input.
    - Generate sequential 3-digit zero-padded project IDs, extending to 4 digits if > `999`.
    - Write details text to `.minna/features/.<id>-<title>.tmp` first.
    - Open database transaction. Insert the `work_items` record and append the creation event.
    - Commit database transaction, then atomically rename the temporary file to `.minna/features/<id>-<title>.md`.
    - If the transaction fails before commit, delete the `.tmp` file in the cleanup block.
    - Implement self-healing: on reading a work item, if the expected `.md` brief is missing but `.tmp` exists, rename it. If both are missing, return the item with `feature_brief_path` metadata so the UI details panel can display a warning banner.
  * **Constraints**: API route handlers and CLI commands must be thin wrappers around this method (Constitution IV). Limit Description field to 100 characters.
  * **Validation/Test Location**: Tested in T011.

- [x] T009 [US3] Implement updateWorkItem (PATCH) with atomic brief write pipeline in src/core/work-items.ts
  * **Target Files**: [src/core/work-items.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/work-items.ts)
  * **Expected Behavior**: Implement core helper for PATCH updates:
    - Write updated brief details text to `.minna/features/.<id>-<title>.tmp`.
    - Open database transaction, update the description column and log the update event.
    - Commit database transaction, then atomically rename `.tmp` to `.minna/features/<id>-<title>.md` (overwriting the old brief file).
    - Delete the `.tmp` file on database write rollback/failure.
  * **Constraints**: Title and ID are immutable on updates. Enforce description length limit.
  * **Validation/Test Location**: Tested in T011.

- [x] T010 Update CLI project initialization callers in src/cli.ts and registry.ts
  * **Target Files**:
    - [src/cli.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/cli.ts)
    - [src/core/registry.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/registry.ts)
  * **Expected Behavior**: Update the database `initDb` invocation lines:
    - In `cli.ts`, call `initDb(journalDatabasePath, embeddedProjectContext?.key);`.
    - In `registry.ts` inside `prepareProject` and other initialization wrappers, call `initDb(databasePath, key);` (passing the actual project ID registry key).
  * **Constraints**: Ensure CLI start-feature continues to work correctly.
  * **Validation/Test Location**: Run `npm run dev:cli status` to verify execution. Tested in T011.

- [x] T011 [US1] [US2] [US3] Write API integration and CLI tests
  * **Target Files**:
    - `src/app/api/work-items/__tests__/work-items.test.ts` (New file)
    - `src/core/__tests__/cli-feature.test.ts` (New file)
  * **Expected Behavior**:
    - Verify POST/GET/PATCH endpoints (asserting 100-char description check, slugification, 3-digit numbering, atomic file write, self-healing rename recovery on read, and 404 response on unknown ID).
    - Write CLI integration tests verifying `start-feature` behaves correctly with the updated generation logic.
  * **Validation/Test Location**: Run `npx jest src/app/api/work-items/__tests__/work-items.test.ts` and verify integration tests pass.

---

## Phase 04: Drop Work Item Backend & API (Priority: P2)

**Goal**: Implement backend actions to soft-drop/archive work items.
* **Independent Test**: Triggering the drop endpoint transitions the item state to `closed` with `closed_reason = dropped` and writes a state change event.

- [x] T012 [US4] Update state update service logic and event payload validation in src/core/work-items.ts
  * **Target Files**: [src/core/work-items.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/work-items.ts)
  * **Expected Behavior**:
    - Update `UpdateWorkItemStateInput` interface and `updateWorkItemState` implementation to accept and persist `closed_reason` under the `work_items` projection.
    - Correct the `work_item.state_changed` event payload construction to yield the shape `{ from, to, blocked_reason, closed_reason }` per the canonical `minna-event-model.md` definition.
  * **Constraints**: Do not overwrite pre-existing `closed_reason` if it was already set.
  * **Validation/Test Location**: Tested in T013.

- [x] T013 [US4] Implement drop route and drop integration tests
  * **Target Files**:
    - `src/app/api/work-items/[id]/drop/route.ts`
    - `src/app/api/work-items/__tests__/work-items.test.ts`
  * **Expected Behavior**:
    - Implement `POST /api/work-items/[id]/drop` which calls repository updates to transition state to `closed` with `closed_reason = dropped`, returning `404 Not Found` if ID does not exist, and `400 Bad Request` if already closed.
    - Write integration tests to check drop constraints, state transition checks, and event journal updates.
  * **Validation/Test Location**: Run `npx jest src/app/api/work-items/__tests__/work-items.test.ts` and assert API tests pass.

---

## Phase 05: Sidebar & Details UI (Priority: P1)

**Goal**: Implement the frontend components, popovers, hover affordances, detail metadata display, and edit/drop confirmation modals.
* **Independent Test**: Sidebar displays project backlogs. Clicking "+" opens the Add Feature modal. Hover and pencil edit opens the pre-filled Update Feature modal. Details view renders in CenterPanel.

- [x] T014 [US2] Render project backlog list in src/components/Sidebar.tsx
  * **Target Files**: [src/components/Sidebar.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/Sidebar.tsx)
  * **Expected Behavior**: Indent work items by 20px under their project. Display status indicator dot, 3-digit ID, and slugified title.
  * **Constraints**: Match visual dimensions and spacing in `handoff/minna-feature-management/design_handoff_feature_crud/Minna Prototype.dc.html#L380-L450`.
  * **Validation/Test Location**: Visual check in dev browser.

- [x] T015 [US2] Render Work Item Details metadata and warnings in src/components/CenterPanel.tsx
  * **Target Files**: [src/components/CenterPanel.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/CenterPanel.tsx)
  * **Expected Behavior**: Modify CenterPanel header and details block to render ID, Title, Description, Type (`feature`), State, Phase (`spec`, `plan`, `tasks`, `spec-review`, etc.), and Assignee (`unassigned` or current value) when selected. If the details brief file is missing, render a warning banner ("Warning: Feature brief not found. Click edit to recreate or attach a new brief.") rather than crashing.
  * **Constraints**: Ensure layout adjusts cleanly for narrow layouts.
  * **Validation/Test Location**: Visual check in dev browser.

- [x] T016 [US1] [US3] Create Add & Update Feature Modal in src/components/AddUpdateFeatureModal.tsx
  * **Target Files**: `src/components/AddUpdateFeatureModal.tsx` (New file)
  * **Expected Behavior**: Build a centered 520px modal. Display read-only ID, Title input (read-only in update mode, max 50 chars), Description input (max 100 chars, enforce directly), and Details tabs.
  * **Constraints**: Match visual styling, gaps, and button rules in `handoff/minna-feature-management/design_handoff_feature_crud/Minna Prototype.dc.html#L520-L592`. Ensure Save button is disabled if form is not dirty.
  * **Validation/Test Location**: Tested in T019.

- [x] T017 [US4] Create Drop Feature and Discard changes confirmation modals
  * **Target Files**:
    - `src/components/DropConfirmModal.tsx` (New file)
    - `src/components/DiscardConfirmModal.tsx` (New file)
  * **Expected Behavior**:
    - DropConfirmModal: 400px modal prompting confirmation to drop the feature (no destructive text, matching corrected prototype wording).
    - DiscardConfirmModal: 380px modal prompting confirmation if the form is dirty when clicking Discard.
  * **Constraints**: Match visual layouts in prototype lines 596-610.
  * **Validation/Test Location**: Tested in T019.

- [x] T018 Connect global context and add post-create navigation in src/components/WorkspaceProvider.tsx
  * **Target Files**: [src/components/WorkspaceProvider.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/WorkspaceProvider.tsx)
  * **Expected Behavior**: Expose functions to create, patch, and drop features. Ensure that successfully creating a feature triggers selection of that new feature, automatically navigating/scrolling to display it in the `CenterPanel` journal view.
  * **Constraints**: Trigger modal states and backdrop clicks correctly.
  * **Validation/Test Location**: Verify in dev browser.

- [x] T019 Write frontend modal and sidebar unit tests in src/components/__tests__/AddUpdateFeatureModal.test.tsx
  * **Target Files**: `src/components/__tests__/AddUpdateFeatureModal.test.tsx` (New file)
  * **Expected Behavior**: Verify inputs validation (max lengths, dirty checks), tab switches, and discard trigger states.
  * **Validation/Test Location**: Run `npx jest src/components/__tests__/AddUpdateFeatureModal.test.tsx` and assert all tests pass.

---

## Phase 06: Release Prep

**Purpose**: Version increments, CHANGELOG edits, and mapping updates.

- [x] T020 Version Bump
  * **Target Files**:
    - [package.json](file:///D:/Alvin/_CodeProjects/Project_Minna/package.json)
    - `package-lock.json`
  * **Expected Behavior**: Increment package.json and lockfile version values to `0.5.0` (or appropriate version).
  * **Validation/Test Location**: Verify package integrity.

- [x] T021 Update Changelog
  * **Target Files**: `CHANGELOG.md`
  * **Expected Behavior**: Document work item backlog, CRUD, details markdown file writing, soft-dropping, and workspace styling features.
  * **Validation/Test Location**: Verify formatting.

- [x] T022 Update Roadmap
  * **Target Files**: [docs/feature_roadmap.md](file:///D:/Alvin/_CodeProjects/Project_Minna/docs/feature_roadmap.md)
  * **Expected Behavior**: Insert/mark `003-work-item-management` status as Completed.
  * **Validation/Test Location**: Verify markdown table rendering.

- [x] T023 Update Documentation maps
  * **Target Files**:
    - `README.md`
    - `docs/REPO_MAP.md`
  * **Expected Behavior**: Update README with work items overview and update repository maps with the new files.
  * **Validation/Test Location**: Verify formatting.

---

## Phase 07: Browser Smoke Test

**Purpose**: Perform end-to-end user checks in a real browser against the build state.

- [ ] T024 E2E Browser Smoke Testing
  * **Target Component**: Sidebar & modal dialogs
  * **Expected Behavior**: Build project (`npm run build`), run dev server (`npm run dev`), open browser and verify:
    1. Hover project, click "+", select Add Feature. Fill details and verify `001-slug-title` is created, selected, and the app automatically navigates to select the feature in the details pane.
    2. Add second feature and check sequential ID `002` is assigned.
    3. Modify description in edit modal, save, verify update.
    4. Click "Drop Feature", confirm, verify state is closed, reason is dropped, and UI details display updates to match. Verify events logs show the transition.
