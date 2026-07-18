# Research: Event Journal

This document resolves the key technical decisions for the **Event Journal** feature, aligning with the Feature Brief, Specification, and the Project Constitution.

## 1. SQLite Access Approach & Dependency Choice

* **Decision**: Use Node's built-in `node:sqlite` module.
* **Rationale**: 
  - Since Node 22.5.0+, Node has a built-in, native SQLite module (`node:sqlite`). The current environment is running Node v24.14.1, which has full, stable support for this module.
  - Using a built-in module requires **zero** external npm dependencies, satisfying **Constitution XII (Simplicity)** and avoiding the need for compiling native binaries (a frequent issue with packages like `better-sqlite3` or `sqlite3` on Windows).
  - High performance, clean API, and zero overhead.
* **Alternatives Considered**:
  - `better-sqlite3`: Highly performant and popular, but requires native compilation which can fail on some environments (especially Windows developer machines) and introduces an external dependency. Rejected due to complexity.
  - `sqlite3`: The traditional asynchronous wrapper. Slow, introduces native binding complexity, and has a callback-heavy API. Rejected.
  - `sql.js`: Pure JS/WASM. Slower than native and requires loading entire DBs into memory. Rejected.

## 2. Migration and Schema Initialization Strategy

* **Decision**: Simple "schema-on-start" raw DDL queries.
* **Rationale**:
  - For M1, the schema is tiny: just two tables (`events` and `features`).
  - Running `CREATE TABLE IF NOT EXISTS` at initialization is robust, deterministic, and requires no migration dependencies.
  - If schema changes are needed in future phases (e.g. M2), they will be evaluated and handled via clean SQLite queries or simple migration scripts rather than adopting heavy frameworks.
* **Alternatives Considered**:
  - Prisma / Knex: Heavyweight ORMs / migration tools. Overkill for M1, violating **Constitution XII**. Rejected.

## 3. Minimal Current-State Projection

* **Decision**: A bare `features` table containing: `id` (text, PK), `title` (text), `status` (text), `created_at` (text, ISO 8601 UTC), and `updated_at` (text, ISO 8601 UTC).
* **Rationale**:
  - Proves the event-to-projection folding mechanism end-to-end without pulling forward M2's workflow/phase engine or Github metadata.
  - Serves as the minimal projection model to demonstrate same-transaction updates and re-derivation.
* **Alternatives Considered**:
  - Reintroducing the full `FeatureState` (phase, decisions, manual tests, etc.): Rejected because those represent M2-level workflow concerns. Pulling them forward violates the spec scope.

## 4. Event Envelope Structure

* **Decision**: Envelope consists of:
  - `id`: integer primary key, autoincrement (provides monotonic ordering).
  - `timestamp`: text, ISO 8601 UTC string (assigned by Minna at write time).
  - `actor`: text (`"human" | "system" | <agent-id string>`).
  - `type`: text dot-namespaced string (e.g. `feature.created`, `feature.status_updated`).
  - `payload`: text (opaque JSON payload, typed in TypeScript at compilation time).
* **Rationale**:
  - Direct mapping to the SQLite columns.
  - Opaque JSON payload allows future event types to define their own structures without requiring schema alterations at the SQLite level, satisfying **Constitution XII**.
* **Alternatives Considered**:
  - Strongly-typed JSON schema validation in the database: Rejected as it introduces runtime overhead and validation complexity at the storage layer. Writing-site TypeScript typing is cleaner and sufficient for our goals.

## 5. Invariant Checks in Verification

* **Decision**: Validate structural replay consistency + exactly one invariant: every row in the `features` projection must trace back to a `feature.created` event in the log.
* **Rationale**:
  - Aligns with **Constitution III**: current state is derived from events, and no state can exist without its creating event.
  - Avoids domain-specific workflow validations (e.g. state transition checks) which belong in M2.
* **Alternatives Considered**:
  - Checking only structural replay (no invariant): Rejected because an orphaned row in `features` would go undetected if it happened to match some replayed events but was never formally created.
  - Fully validating business/phase rules: Rejected as those are M2 features.

## 6. Export Format and Destination

* **Decision**: Render feature history as a Markdown file (`journal.md`) inside the feature directory (e.g. `specs/001-event-journal/journal.md`).
* **Rationale**:
  - Serves human readability and git committability per **Constitution VI**.
  - Simple, structured, and easy for the operator to inspect in Git.
* **Alternatives Considered**:
  - Exporting JSONL alongside Markdown: Rejected because the SQLite database itself is already the machine-readable store. A second machine-readable copy is redundant and adds unneeded complexity.
