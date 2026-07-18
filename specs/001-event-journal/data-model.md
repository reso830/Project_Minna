# Data Model: Event Journal

This document defines the schema, event formats, and projection logic for the **Event Journal** feature.

## 1. SQLite Database Schema

The database file resides at `.minna/minna.db`. It contains two tables: `events` (the append-only log) and `features` (the current-state projection).

### `events` Table

This table stores the record of all historical state transitions.

```sql
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,          -- ISO 8601 format, UTC timezone (e.g. "2026-07-16T21:26:08Z")
    actor TEXT NOT NULL,              -- 'human', 'system', or agent-id string
    type TEXT NOT NULL,               -- Dot-namespaced string (e.g. 'feature.created')
    payload TEXT NOT NULL             -- Opaque JSON string containing event-specific data
);

-- triggers to enforce append-only behavior at the database engine level (Constitution III)
CREATE TRIGGER IF NOT EXISTS prevent_event_update
BEFORE UPDATE ON events
BEGIN
    SELECT RAISE(ROLLBACK, 'Updates are not allowed on the append-only events journal.');
END;

CREATE TRIGGER IF NOT EXISTS prevent_event_delete
BEFORE DELETE ON events
BEGIN
    SELECT RAISE(ROLLBACK, 'Deletions are not allowed on the append-only events journal.');
END;
```

### `features` Table

This table stores the current-state projection derived from the event journal.

```sql
CREATE TABLE IF NOT EXISTS features (
    id TEXT PRIMARY KEY,              -- Slugified unique identifier (matches payload.id of feature.created)
    title TEXT NOT NULL,              -- Human-readable title
    status TEXT NOT NULL,             -- Current generic status string (required, caller-supplied, no default)
    created_at TEXT NOT NULL,         -- Matches timestamp of the creating feature.created event
    updated_at TEXT NOT NULL          -- Matches timestamp of the most recent event affecting this feature
);
```

---

## 2. Event Payload Contracts

The `payload` column in the `events` table contains serialized JSON objects. Storage and
writes impose no journal-enforced payload schema; TypeScript types at each supported
write site define the envelope. When replaying, filtering, verifying, or exporting the
supported event types, the journal parses their payloads to derive and render the
feature projection. The schema of these payloads is defined below.

### Event Type: `feature.created`

Emitted when a new feature is initialized.

* **Payload Structure**:
  ```json
  {
    "id": "slugified-project-title-timestamp",
    "title": "Human Readable Title",
    "status": "initial-status-string"
  }
  ```
* **TypeScript Interface**:
  ```typescript
  interface FeatureCreatedPayload {
    id: string;
    title: string;
    status: string; // Required, caller-supplied parameter
  }
  ```

### Event Type: `feature.status_updated`

Emitted when the status of an existing feature changes.

* **Payload Structure**:
  ```json
  {
    "id": "slugified-project-title-timestamp",
    "status": "new-status-string"
  }
  ```
* **TypeScript Interface**:
  ```typescript
  interface FeatureStatusUpdatedPayload {
    id: string;
    status: string;
  }
  ```

---

## 3. Projection Logic (Event Folding)

The `features` projection is derived by replaying events from the `events` table in order of their `id`.

### Step-by-Step Folding Algorithm:
1. Initialize an empty Map `projectedFeatures: Map<string, FeatureProjection>`.
2. Retrieve all events from the `events` table matching types `feature.created` and `feature.status_updated`, sorted by `id` ASC.
3. For each event:
   - Parse `event.payload` as JSON.
   - If `event.type === 'feature.created'`:
     - Assert that `payload.id` is not already in `projectedFeatures` (Duplicate Creation check).
     - Set in `projectedFeatures`:
       ```typescript
       {
         id: payload.id,
         title: payload.title,
         status: payload.status, // Caller-supplied status (no default)
         created_at: event.timestamp,
         updated_at: event.timestamp // updated_at == created_at
       }
       ```
   - If `event.type === 'feature.status_updated'`:
     - Assert that `projectedFeatures` has a record for `payload.id` (Orphan Update check).
     - Update the record in `projectedFeatures`:
       - `status = payload.status`
       - `updated_at = event.timestamp`
4. The resulting `projectedFeatures` Map represents the true expected current state.

---

## 4. Integrity and Consistency Invariants

1. **Monotonicity**: The `events.id` field is auto-incrementing. Sequential state mutations must correspond to increasing event IDs.
2. **Transaction Bound**: Every insert into the `events` table and its associated update to the `features` table must occur within the same `BEGIN TRANSACTION ... COMMIT` block.
3. **Exactly One Creator**: Every entry in the `features` table must have EXACTLY ONE corresponding `feature.created` event in the `events` log. A row with zero or multiple creation events is a violation.
4. **Replay Equivalence**: A clean replay of the event log must yield exactly the same rows and field values as currently stored in the `features` table. Any difference constitutes database drift.
5. **Atomic Testing (Fault Injection)**: To verify AC-2 (all-or-nothing transaction execution), the write path exposes an internal test-only function `_recordEvent` which supports a `faultInjection` option (e.g. throwing an error post-event-write, prior to projection write) which allows automated tests to prove that failures rollback both writes. The public production API does not expose this parameter.
