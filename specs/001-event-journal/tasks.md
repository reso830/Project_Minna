# Tasks: Event Journal

## Conventions

* **Status Legend**: `[ ]` pending · `[x]` done · `[~]` skipped
* **Parallel Marker `[P]`**: Can run in parallel (different files, no shared edits)
* **Phase Dependency**: `01 -> 02 -> 03 -> 04 -> 05`
* **Project Commands**:
  - Build: `npm run build`
  - Run tests: `npm run test`
  - Run CLI dev: `npm run dev`
  - TypeScript typecheck: `npx tsc --noEmit`

---

## Phase Summary Table

| Phase | Focus/Name | Task ID Range | Stories / Requirements Covered |
|---|---|---|---|
| 01 | Setup & Database Initialization | T001 - T004 | — (Foundational Prerequisite) |
| 02 | Transactional Write Path | T005 - T007 | US2 (Transaction Writes) |
| 03 | CLI Commands Implementation | T008 - T013 | US1 (Logging), US3 (Verification), US4 (Export), Legacy Disabling |
| 04 | Workflow Smoke Test | T014 | — (Gate Verification) |
| 05 | Release Prep | T015 - T019 | — (Governance & Release) |

---

## Phase 01: Setup & Database Initialization

**Purpose**: Set up database files, table schemas, triggers, and initialization checks.

- [x] **T001** `[P]` **[Setup] Define types for database events and projections in `src/core/types.ts`**
  - *Target File*: `src/core/types.ts`
  - *Expected Behavior*: Introduce type interfaces `EventEnvelope` and `FeatureProjection` corresponding to the schemas in [api.md](file:///D:/Alvin/_CodeProjects/Project_Minna/specs/001-event-journal/contracts/api.md). Clarify that `contracts/api.md` is documentation-only, and `src/core/types.ts` is the sole source of truth for runtime types.
  - *Constraints*: No external NPM libraries. Ensure types compile cleanly with existing features code.
  - *Validation*: Run `npx tsc --noEmit`.

- [x] **T002** **[Setup] Implement database initialization and triggers in `src/core/db.ts`**
  - *Target File*: `src/core/db.ts`
  - *Expected Behavior*: Create a module that connects to SQLite database and exposes `initDb(dbPath?: string)`. It runs DDL queries (`CREATE TABLE IF NOT EXISTS`) for `events` and `features` tables. Also creates BEFORE UPDATE and BEFORE DELETE triggers on `events` that execute `SELECT RAISE(ROLLBACK, ...)` to fully abort and rollback the entire transaction on any update or deletion attempt. Sets SQLite `PRAGMA foreign_keys = ON;`.
  - *Constraints*: Must use Node's built-in `node:sqlite` module. Database must reside at `.minna/minna.db` by default. Must fail closed (throw error) if the directory is un-writable.
  - *Validation*: Runs compile without errors.

- [x] **T003** **[Setup] Create testing environment and initial test suite in `src/core/db.test.ts`**
  - *Target File*: `src/core/db.test.ts`
  - *Expected Behavior*: Implement a unit test suite using Node's native test runner (`node --test`). Test initialization by passing a temporary database path (e.g. `./state/test-db.db`), validating that `events` and `features` tables and ROLLBACK triggers are created.
  - *Constraints*: Clean up test database files after execution.
  - *Validation*: Run `npm run test` and confirm it passes.

- [x] **T004** **[Setup] Integrate database initialization on application startup**
  - *Target File*: `src/cli.ts`
  - *Expected Behavior*: Call `initDb()` at the top of the `main()` function in `src/cli.ts` to ensure database tables are present before running any commands.
  - *Validation*: Run `npm run dev status` and confirm `.minna/minna.db` is created.

---

## Phase 02: Transactional Write Path

**Purpose**: Implement same-transaction event logging, projection updates, and database-level append-only constraints.

**⚠️ CRITICAL**: No CLI commands can begin until this phase's transactional integrity and trigger blocks are fully verified.

**Contract refinement (identified during implementation)**: Every Phase 02 write API receives an explicit caller-opened `DatabaseSync` connection as its first argument. This makes the database context explicit for production callers and scratch-database tests, without hidden module-level path state.

- [x] **T005** **[US2] Write unit tests FIRST in `src/core/db.test.ts` for transaction rollback, triggers, and duplicate creation constraints**
  - *Target File*: `src/core/db.test.ts`
  - *Expected Behavior*:
    1. Test same-transaction rollback: call the internal test-only `_recordEvent(db, ...)` write API with `options.faultInjection = true`. Verify that the transaction throws an error, no row is written to the `events` table, and no row is written to the `features` projection table.
    2. Test append-only trigger ROLLBACK: execute an UPDATE or DELETE query on the `events` table inside a transaction block along with another query (e.g. an insert into a dummy table or features modification). Verify that the trigger throws an error, the entire transaction is rolled back, and no changes are committed to any table.
    3. Test fail-closed update: calling `updateFeatureStatus` for an unknown feature ID rejects the transaction and writes nothing.
    4. Test duplicate creation check: calling `createFeature` twice with the same ID rejects the transaction on the second call and writes no new rows to `events` or `features` (re-asserting EXACTLY ONE creator).
  - *Validation*: Run `npm run test` and assert these new tests fail (Red phase).

- [x] **T006** **[US2] Implement transactional write engine and internal `_recordEvent` in `src/core/db.ts`**
  - *Target File*: `src/core/db.ts`
  - *Expected Behavior*: Implement `recordEvent(db, actor, type, payload)` wrapping SQL queries in a `BEGIN TRANSACTION` ... `COMMIT` / `ROLLBACK` SQLite sequence. Support the internal `_recordEvent(db, actor, type, payload, options)` method with the `options.faultInjection` parameter to throw an error immediately post-event-write, prior to committing or writing the projection.
  - *Constraints*: Handle exceptions by invoking `ROLLBACK` and propagating the exception upward (fail closed).
  - *Validation*: Run `npm run test` and confirm `recordEvent` and trigger tests pass.

- [x] **T007** **[US2] Implement `createFeature` and `updateFeatureStatus` in `src/core/db.ts`**
  - *Target File*: `src/core/db.ts`
  - *Expected Behavior*:
    - `createFeature(db, actor, id, title, status)`: Records `feature.created` event and inserts a row in `features` table. At creation, `updated_at == created_at`. Status is a required parameter. Throws/fails closed if feature already exists.
    - `updateFeatureStatus(db, actor, id, status)`: Records `feature.status_updated` event and updates `status` and `updated_at` in `features`. Throws if feature doesn't exist (fail-closed).
  - *Validation*: Run `npm run test` and confirm transaction tests pass (Green phase).

---

## Phase 03: CLI Commands Implementation

**Purpose**: Expose Event Journal tools to the command-line surface and disable legacy state-mutating commands.

**Contract refinement (identified during implementation)**: Phase 03 read, verification, and export APIs receive an explicit caller-opened `DatabaseSync` connection, matching the Phase 02 write API convention. `openDb(dbPath?)` supplies the connection after `initDb()`; the caller closes it after use.

- [x] **T008** **[US1] Implement `minna log [--feature <id>]` command**
  - *Target File*: `src/cli.ts`, `src/core/db.ts`
  - *Expected Behavior*: Query `events` sorted by `id` ASC. Limit output to events whose parsed `payload.id` exactly equals `<id>` if `--feature <id>` is provided. Print entries in a standard readable CLI line. Exit `0` on success.
  - *Constraints*: If `--feature <id>` is provided but `<id>` has no `feature.created` event, exit `1` with `"Error: No such feature '<id>'"` (fail closed). If database has no events, print `"No events found in journal."` and exit `0`.
  - *Validation*: Run manually via `npm run dev log`.

- [x] **T009** **[US3] Implement DB fold replay function in `src/core/db.ts`**
  - *Target File*: `src/core/db.ts`
  - *Expected Behavior*: Implement `verifyDb(db)` which fetches all log events, folds them sequentially in memory to produce a computed projection, and compares it row-by-row and field-by-field against the physical `features` table.
  - *Constraints*: Assert invariant: every row in the `features` projection table must have EXACTLY ONE corresponding `feature.created` event in the log. Any duplicate creation events or missing creation events trigger verification failure.
  - *Validation*: Verify compiles cleanly.

- [x] **T010** **[US3] Expose `minna verify` command in CLI**
  - *Target File*: `src/cli.ts`
  - *Expected Behavior*: Invoke `verifyDb()`. On success, print success message and exit `0`. On drift or invariant failure, print detailed discrepancy report to stderr and exit `1`.
  - *Validation*: Write test in `src/core/db.test.ts` that manually modifies a field in `features` table bypass-API and confirms `verifyDb()` detects the drift.

- [x] **T011** **[US4] Implement Markdown export timeline function in `src/core/db.ts`**
  - *Target File*: `src/core/db.ts`
  - *Expected Behavior*: Implement `exportFeatureJournal(db, featureId)` to fetch chronological events for a feature and render them into a Markdown table layout.
  - *Constraints*: Throw if the feature ID does not exist in the journal.
  - *Validation*: Compile and test unit behavior.

- [x] **T012** **[US4] Expose `minna export --feature <id> <dir>` command in CLI**
  - *Target File*: `src/cli.ts`
  - *Expected Behavior*: Call export helper. Ensure `<dir>` is created if missing, and write the timeline to `<dir>/journal.md`. Overwrite the file if it already exists.
  - *Validation*: Execute command manually via CLI and verify `journal.md` is populated.

- [x] **T013** **[Setup] Disable legacy state-mutating commands in CLI and MCP**
  - *Target Files*: `src/cli.ts`, `src/server/tools.ts`, `src/server/mcp.ts`
  - *Expected Behavior*:
    1. In `src/cli.ts`: Modify `startFeatureCommand`, `recordDecisionCommand`, and `recordManualTestCommand` to print `"Error: Command disabled in M1. Event Journal write API is the sole state mutation path; integration is deferred to M2."` and exit `1` immediately.
    2. In `src/cli.ts`: Update `printHelp()` list to mark `start-feature`, `record-decision`, and `record-manual-test` as `[DISABLED in M1]`.
    3. In `src/server/tools.ts`: Update `handleToolCall` to throw an error for `start_feature`, `record_decision`, and `record_manual_test` (e.g. `"Tool disabled in M1."`).
    4. In `src/server/mcp.ts`: Remove `start_feature`, `record_decision`, and `record_manual_test` from the advertised tools array in the `ListToolsRequestSchema` handler.
  - *Constraints*: Do not delete original code structure needlessly; intercept and block mutations cleanly.
  - *Validation*: Run commands and query MCP server tools list to verify they fail/are omitted.

---

## Phase 04: Workflow Smoke Test

**Purpose**: Execute end-to-end integration and smoke verification workflows.

- [x] **T014** **[Verify] Execute scripted Workflow Smoke Test**
  - *Target Files*: CLI and MCP server environments
  - *Expected Behavior*: Manually run the following sequence and confirm expected outcomes:
    1. Initialize database: confirm `.minna/minna.db` is created.
    2. Seed database using a native Node command to call the database API directly (using the neutral status `'initial'`):
       `node --import tsx -e "import { initDb, openDb, createFeature } from './src/core/db.js'; await initDb(); const db = openDb(); try { await createFeature(db, 'human', 'smoke-validation', 'Smoke Validation Title', 'initial'); } finally { db.close(); }"`
    3. Run `npm run dev log`: confirm event history list shows creation event.
    4. Run `npm run dev verify`: confirm exits `0` with success message.
    5. Access database directly via Node.js script using built-in `node:sqlite` to corrupt the projection:
       `node -e "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync('.minna/minna.db'); db.prepare(\"UPDATE features SET status = 'corrupted' WHERE id = 'smoke-validation';\").run();"`
    6. Run `npm run dev verify`: confirm command exits `1` (non-zero) and outputs the drift on stderr.
    7. Run `npm run dev verify` again: confirm it did not repair the drift.
    8. Run `npm run dev export --feature smoke-validation ./specs/001-event-journal`: confirm `./specs/001-event-journal/journal.md` is created containing the formatted Markdown timeline.
    9. Verify that ALL legacy state-mutating CLI commands exit `1` and print the disabled error message:
       - Run `npm run dev start-feature --project test --title "fail"`
       - Run `npm run dev record-decision --feature test --question q --answer a`
       - Run `npm run dev record-manual-test --feature test --passed true`
    10. Run a node script to test that ALL THREE legacy state-mutating MCP tools calls fail closed:
        `node --import tsx -e "import { handleToolCall } from './src/server/tools.js'; for (const tool of ['start_feature', 'record_decision', 'record_manual_test']) { try { await handleToolCall(tool); throw new Error(tool + ' should have failed'); } catch (e) { console.log('MCP ' + tool + ' disabled as expected:', e.message); } }"`
  - *Validation*: All steps succeed as described.

---

## Phase 05: Release Prep

**Purpose**: Prepare and finalize documentation, governance rules, and versioning updates.

- [x] **T015** **[Release] Update `CHANGELOG.md`**
  - *Target File*: `CHANGELOG.md`
  - *Expected Behavior*: Document release notes for v0.2.0 detailing Event Journal, SQLite integration, commands `log`, `verify`, `export`, and state API changes.

- [x] **T016** **[Release] Update feature roadmap status**
  - *Target File*: `docs/feature_roadmap.md`
  - *Expected Behavior*: Mark the event journal feature row as completed.

- [x] **T017** **[Release] Update `README.md`**
  - *Target File*: `README.md`
  - *Expected Behavior*: Add documentation for the new CLI commands (`log`, `verify`, `export`) and update configuration descriptions to mention SQLite. (Do NOT document modifications to `start-feature` CLI command or disabled MCP tools).

- [x] **T018** **[Release] Bump version in `package.json` and lockfile**
  - *Target File*: `package.json`, `package-lock.json`
  - *Expected Behavior*: Bump the version to `0.2.0`. Run `npm install` to synchronize the package-lock file.
  - *Validation*: Version updates are reflected in `package.json`.

- [x] **T019** **[Release] Conduct documentation sanity check**
  - *Target File*: `.specify/memory/constitution.md`, specs directory
  - *Expected Behavior*: Validate that all feature documentation complies with Constitution Principles VII and VIII (Documentation and Release Prep discipline).
