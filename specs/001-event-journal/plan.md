# Implementation Plan: Event Journal

**Branch**: `001-event-journal` | **Date**: 2026-07-16 | **Spec**: [spec.md](file:///D:/Alvin/_CodeProjects/Project_Minna/specs/001-event-journal/spec.md)
**Input**: Feature specification from `/specs/001-event-journal/spec.md`

## Summary

The Event Journal is Minna's local-first authoritative state store. We will replace the mutable JSON file-backed state (`src/core/state.ts`) with an append-only event log stored in a local SQLite database (`.minna/minna.db`) paired with a same-transaction current-state projection. This implementation uses the native, zero-dependency `node:sqlite` module in Node.js to record history, verify projection consistency against historical events (confirming every projection row traces to EXACTLY ONE creation event), export feature-specific Markdown journals, and expose necessary CLI commands (`minna log`, `minna verify`, `minna export`). The database write path requires the caller to supply a custom status on creation (no defaults), at which point `updated_at == created_at`. To enforce the append-only property at the SQLite layer, database triggers abort any UPDATE/DELETE queries against `events` and roll back the entire transaction. To test mid-transaction atomicity without exposing corruption mechanisms in production, the write module exports a separate, test-only `_recordEvent` API containing a fault-injection seam. All integration with the legacy `start-feature` CLI command and phase-machine status mapping is deferred entirely to M2; in M1, legacy state-mutating CLI commands (`start-feature`, `record-decision`, `record-manual-test`) and their corresponding MCP server tools (`start_feature`, `record_decision`, `record_manual_test`) are disabled to prevent split-state authoritative paths, and `state/features.json` is treated as a read-only deprecated archive. Features are created in the SQLite database only via the database library write API.

---

## Technical Context

* **Language/Version**: Node.js (TypeScript, ES Modules, running Node v24.14.1; requires engines.node >=22.13.0 because that is the first Node 22 release where built-in `node:sqlite` no longer requires the `--experimental-sqlite` runtime flag. Note that `node:sqlite` is currently flagged as experimental by Node.js and prints an `ExperimentalWarning` on execution, which is an accepted risk for M1 per Constitution VI).
* **Primary Dependencies**: Built-in `node:sqlite` (zero npm dependencies)
* **Storage**: SQLite (`.minna/minna.db`)
* **Testing**: Node.js built-in test runner (`node --test`)
* **Target Platform**: Local command-line execution
* **Project Type**: CLI tool & orchestrator library
* **Performance Goals**: Sub-millisecond database writes and reads
* **Constraints**: Purely local-first, offline, single-operator focus, zero external services
* **Scale/Scope**: Limited to initial feature creation/status updates and log verification/export

---

## Constitution Check

This feature directly establishes the storage primitives demanded by the Project Constitution.

* **Principle III (State Is The Source Of Truth)**: Authoritative state is held as an append-only event journal with a same-transaction current-state projection.
  - *Compliance*: `recordEvent` wraps the INSERT of the event and the INSERT/UPDATE of the `features` projection table in a single SQLite transaction. Any error rolls back both. A projection row must trace to EXACTLY ONE `feature.created` event. If a creation event is recorded for an existing ID, it fails closed.
* **Keep Business Logic in Core**: Business logic belongs in core services; CLI/MCP are thin wrappers.
  - *Compliance*: All SQL execution, transaction management, and fold/verify logic live in `src/core/db.ts`. The CLI and MCP serve-mcp handlers only parse inputs and format outputs.
* **Principle VI (Local-First, Inspectable State)**: SQLite event journal (`.minna/minna.db`); human-readability via `minna log`, `minna verify`, and committed exports to feature directories. No hand-editable files.
  - *Compliance*: We use SQLite directly, implement `minna log` to query it, `minna verify` to check drift, and `minna export` to write plain text Markdown.
* **Principle XII (Simplicity Before Scale)**: Choose the simplest architecture and justify dependencies.
  - *Compliance*: We leverage Node's built-in `node:sqlite` module. No external packages (like `prisma` or `better-sqlite3`) are added. Schema migrations are avoided; tables are created via raw `CREATE TABLE IF NOT EXISTS` during database initialization.
* **Principle XIII (Minna Owns Git; Subprocess Boundary)**: No agent gets state-mutating or git authority.
  - *Compliance*: System commands fail closed with non-zero exit codes on error. Write APIs are inaccessible to external agents. No auto-approve/bypass flags exist.
* **Principle XVI (Cost & Quota)**: Token economy is a design constraint; no paid APIs.
  - *Compliance*: SQLite database operations run entirely locally at zero cost.

---

## Project Structure

### Documentation (this feature)

Note: `contracts/api.md` defines the abstract API contract, while `src/core/types.ts` is the sole source of truth for runtime execution types.

```text
specs/001-event-journal/
├── plan.md              # This file
├── research.md          # Technical choice and design decisions
├── data-model.md        # Database schema and projection fold algorithm
├── quickstart.md        # CLI/API developer usage guide
├── contracts/           # API and CLI command surface contracts
│   ├── api.md
│   └── cli.md
└── checklists/
    └── plan-review.md   # Pre-implementation verification checklist
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── db.ts           # [NEW] Low-level SQLite database connection and transaction handling
│   └── ...
└── cli.ts              # [MODIFIED] Integrates log, verify, and export CLI commands; disables legacy state-mutating commands
```

**Structure Decision**: Code changes are housed in the database layer (`src/core/db.ts`) and exposed via the command-line entrypoint (`src/cli.ts`). All phase-machine status reporting is deferred to M2.

---

## Architecture and Data Flow

### Write Flow (Event + Projection Transaction)
```text
[API Call]
       ↓
[src/core/db.ts: createFeature / updateFeatureStatus]
       ↓
[src/core/db.ts: recordEvent] (Internal helper)
       ↓
  SQLite: BEGIN TRANSACTION
  SQLite: INSERT INTO events (type, actor, payload, timestamp)
  SQLite: INSERT/UPDATE features (id, title, status, created_at, updated_at)
  SQLite: COMMIT TRANSACTION
       ↓ (if any error occurs)
  SQLite: ROLLBACK
```

### Verification Flow (Replay Consistency Check)
```text
[CLI: minna verify]
       ↓
[src/core/db.ts: verifyDb]
       ↓
  1. SQLite: SELECT * FROM events ORDER BY id ASC
  2. In-Memory: Run fold logic to compute projected features
  3. SQLite: SELECT * FROM features
  4. Compare in-memory state vs database projection table
  5. Invariant check: Verify every projection row has a feature.created event
       ↓ (mismatch or invariant failure)
  Exit 1 (Report drift)
       ↓ (success)
  Exit 0 (Report verification success)
```

---

## Affected Areas

### Files/Components likely to be Inspected
* `src/cli.ts` (CLI argument router)
* `src/core/state.ts` (existing JSON-file read/write interface)
* `src/core/types.ts` (existing domain models)
* `src/core/workflow.ts` (workflow state queries)

### Files/Components likely to be Modified
* `src/core/db.ts` (New file: handles SQL creation schemas, database connection, database verify logic, raw transaction functions, ROLLBACK triggers, and test-only exports)
* `src/core/types.ts` (Will modify `FeatureState` or add event and projection types)
* `src/cli.ts` (Will add `log`, `verify`, and `export` commands; will modify legacy `start-feature`, `record-decision`, and `record-manual-test` to print an error and exit non-zero; will update `printHelp()` list to mark these commands disabled)
* `src/server/tools.ts` and `src/server/mcp.ts` (Will disable/remove legacy state-mutating tools `start_feature`, `record_decision`, `record_manual_test` from the MCP tool surface)
* `package.json` (Bump node engine version to `node:sqlite` requirement)

### Tests likely to be Added or Updated
* `src/core/db.test.ts` (New file: unit tests database connections, append-only trigger transaction rollback enforcement, transaction rollbacks on failure via the internal test-only `_recordEvent` seam, and verify replay consistency)

### Areas Explicitly Out of Scope
* `src/core/state.ts` (Legacy state management file remains completely untouched; the commands and MCP tools that call it are disabled at the wrapper layers to prevent split-state writes, deferred to M2)
* `src/core/workflow.ts` and `workflows/speckit-feature.yaml` (The workflow phase machine remains completely untouched for this feature, deferred to M2)
* Checkpoints and git integrations (Feature 002)
* Agent execution wrapper (Feature 003)
* Findings, reviews, and human approvals (M2)
* SQLite file-locking / concurrent writer locks (deferred as per Constitution VI: single-operator first)

---

## Risks and Tradeoffs

* **Risk**: Process interruption mid-transaction could leave partial state.
  - *Tradeoff/Mitigation*: SQLite transaction blocks provide native ACID compliance. Process termination mid-transaction guarantees that SQLite reverts automatically to the pre-transaction state.
* **Risk**: Drift from external tampering.
  - *Tradeoff/Mitigation*: Hand-editing `.minna/minna.db` cannot be strictly prevented by a CLI tool. We mitigate this by implementing `minna verify`, which detects drift immediately and exits non-zero, allowing the operator to address corruption.

---

## Validation Approach

1. **Unit and Integration Tests**:
   - Seed events in a test database, fold them, and compare against the projection.
   - Verify transaction rollback by calling `_recordEvent` with `options.faultInjection = true` to throw an error after the event write, asserting no rows are written to either `events` or `features` (all-or-nothing atomicity verification).
   - Verify append-only enforcement by executing manual SQL UPDATE and DELETE queries against the `events` table within a transaction, asserting they fail and fully rollback the entire transaction (leaving other updates in the transaction uncommitted) with a SQLite trigger error.
   - Verify invariant failure by writing a row to `features` without a corresponding `feature.created` event, or writing multiple `feature.created` events for the same `id` using raw queries, then asserting `minna verify` detects it and fails (exactly one creator check).
2. **CLI Invocations**:
   - Seed database using `node --import tsx -e "..."` write API call.
   - Run `npm run dev log`.
   - Run `npm run dev verify` and check exit codes.
   - Inject a manual SQL query via a Node script to corrupt the projection, run `npm run dev verify`, and assert exit code is `1` with a detailed error.
   - Run `npm run dev export --feature <id> <dir>` and assert that `<dir>/journal.md` is populated correctly.

---

## Complexity Tracking

No constitutional violations exist. Simple native Node features and raw DDL/DML statements are leveraged.
