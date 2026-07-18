# Database API Contract

This contract defines the library interface (TypeScript API) for interacting with the **Event Journal** database. These methods reside in `src/core/db.ts` and are called by other system services.

Note: `contracts/api.md` defines the abstract API contract, while `src/core/types.ts` is the sole source of truth for runtime execution types.

## 1. Type Definitions

```typescript
export type Actor = "human" | "system" | (string & {}); // Preserves literal autocomplete in IDE while allowing custom string ids

export interface FeatureProjection {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface FeatureCreatedPayload {
  id: string;
  title: string;
  status: string;
}

export interface FeatureStatusUpdatedPayload {
  id: string;
  status: string;
}

export interface EventEnvelope<TPayload = unknown> {
  id?: number;            // Assigned by SQLite (autoincrement) on write, present on read
  timestamp: string;      // ISO 8601 string in UTC format
  actor: Actor;
  type: string;
  payload: TPayload;
}

import type { DatabaseSync } from "node:sqlite";
```

### Phase 02 contract refinement

Every write method receives an explicit `DatabaseSync` connection as its first argument. This refinement was identified during Phase 02 implementation so tests and callers can choose the intended database context explicitly, rather than relying on hidden module-level database-path state.

### Phase 03 contract refinement

Every read, verification, and export method also receives an explicit `DatabaseSync` connection. `openDb(dbPath?)` is the core-owned connection factory used by interfaces after `initDb()` has initialized the target database; callers close the returned connection when their operation completes.

## 2. API Methods

### `initDb(dbPath?: string): Promise<void>`
Initializes the SQLite database. Creates the `events` and `features` tables and triggers if they do not exist.
* **dbPath**: Optional custom path to the database file (defaults to `.minna/minna.db`). Primarily used to supply a scratch file path during testing.
* **Behavior**:
  - Ensures the directory of the database file exists.
  - Executes table and trigger creation SQL schemas.
  - Sets up necessary SQLite pragmas (e.g. `PRAGMA foreign_keys = ON;`).

### `openDb(dbPath?: string): DatabaseSync`
Opens the initialized journal database at the supplied path or `.minna/minna.db` by default.
* **Returns**: A caller-owned connection configured with the journal's SQLite pragmas.

---

### `recordEvent(db: DatabaseSync, actor: Actor, type: "feature.created" | "feature.status_updated", payload: FeatureCreatedPayload | FeatureStatusUpdatedPayload): Promise<void>`
Generic, low-level write path that wraps operations in a transaction.
* **db**: The caller-opened SQLite connection for the intended journal database.
* **actor**: The entity performing the action.
* **type**: Event type namespace.
* **payload**: Payload object.
* **Behavior**:
  - Begins a transaction.
  - Inserts the event envelope into the `events` table (serializes `payload` to JSON string).
  - Validates and updates the `features` projection within the same transaction.
  - Commits on success, rolls back on any error.

---

### `createFeature(db: DatabaseSync, actor: Actor, id: string, title: string, status: string): Promise<FeatureProjection>`
Domain helper to record feature creation.
* **db**: The caller-opened SQLite connection for the intended journal database.
* **actor**: The creator entity.
* **id**: Unique slugified identifier.
* **title**: Human-readable title.
* **status**: Required caller-supplied status.
* **Returns**: The newly projected feature.
* **Exceptions**: Throws if a feature with `id` already exists (fail-closed duplicate check).

---

### `updateFeatureStatus(db: DatabaseSync, actor: Actor, id: string, status: string): Promise<FeatureProjection>`
Domain helper to record feature status changes.
* **db**: The caller-opened SQLite connection for the intended journal database.
* **actor**: The mutating entity.
* **id**: Unique identifier of the feature.
* **status**: The new status string.
* **Returns**: The updated feature projection.
* **Exceptions**: Throws if the feature with `id` does not exist (fail-closed constraint).

---

### `readEvents(db: DatabaseSync, filter?: { featureId?: string }): Promise<EventEnvelope[]>`
Retrieves events from the journal.
* **db**: The caller-opened SQLite connection for the intended journal database.
* **filter.featureId**: If provided, returns only events whose serialized JSON payload has an `id` matching the query.
* **Returns**: Array of `EventEnvelope` sorted by `id` ASC.

---

### `readFeatures(db: DatabaseSync): Promise<FeatureProjection[]>`
Retrieves all current projected feature rows from the database.
* **db**: The caller-opened SQLite connection for the intended journal database.
* **Returns**: Array of `FeatureProjection`.

---

### `verifyDb(db: DatabaseSync): Promise<{ consistent: boolean; featureCount: number; eventCount: number; discrepancies: string[] }>`
Replays the journal in memory and compares the derived projection to stored `features` rows without repairing either source.
* **db**: The caller-opened SQLite connection for the intended journal database.
* **Returns**: Counts plus `consistent: boolean` and detailed `discrepancies` when drift or an invariant violation is found.

---

### `exportFeatureJournal(db: DatabaseSync, featureId: string): Promise<string>`
Renders one feature's chronological journal timeline as Markdown.
* **db**: The caller-opened SQLite connection for the intended journal database.
* **Exceptions**: Throws `Error: No such feature '<id>'` if no `feature.created` event exists for the requested id.

---

## 3. Test-Only Internal API Methods

These functions are exported strictly for automated unit testing (via prefixing or internal exports in `src/core/db.ts`) and must not be consumed by production code.

### `_recordEvent(db: DatabaseSync, actor: Actor, type: "feature.created" | "feature.status_updated", payload: FeatureCreatedPayload | FeatureStatusUpdatedPayload, options?: { faultInjection?: boolean }): Promise<void>`
Internal write path with fault-injection support.
* **db**: The caller-opened SQLite connection for the intended scratch/test database.
* **options.faultInjection**: If true, throws an error immediately after writing the event to the log but prior to executing the projection write.
