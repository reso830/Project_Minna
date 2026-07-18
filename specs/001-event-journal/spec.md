# Feature Specification: Event Journal

**Feature Branch**: `001-event-journal`
**Created**: 2026-07-16
**Status**: Implemented — pending human acceptance
**Input**: `docs/features/1.0.0-safety-net/001-event-journal.md`

## Clarifications

### Session 2026-07-16

- Q: What's the minimal current-state projection to build now, proving the
  same-transaction event→projection mechanism without pulling forward M2's full
  work-item model? → A: A bare feature-identity table, but drop `phase` — phase is
  M2 workflow state and 001 must not model the domain. Use a generic `status` field
  in its place.
- Q: How should the event envelope represent `actor` and the event `payload`? → A:
  `actor` is `"human" | "system" | (string & {})` (retains autocomplete for literals in TS).
  `payload` is opaque JSON at the storage and write-envelope layer: the journal
  enforces no payload schema and each write site supplies its TypeScript type. The
  current replay, filtering, and export paths parse the two supported event payloads
  to derive, validate, and render the feature projection.
- Q: Should `minna verify` check only structural consistency, or also enforce
  invariants? → A: Structural re-derivation plus exactly one invariant — every
  current-state row must trace to EXACTLY ONE `feature.created` event in the log (Article III).
  This invariant is the journal's core guarantee. Domain-specific invariants (e.g. valid
  phase transitions) defer to the features that introduce that domain state.
- Q: What should `minna export <dir>` produce, and where does it land? → A: A
  human-readable Markdown timeline per feature, committed to the feature
  directory. No JSONL — the SQLite journal is already the machine-readable source
  of truth; a second machine format has no consumer in scope (Article VI serves
  human readability, Article XII defers speculative surface).

## Problem Statement

Minna has no durable, inspectable record of what happened. The retired
`ai-flow.ps1` derived gate state from LLM prose and scattered untracked files, so
"what happened, in what order, and does current state match history" was
unanswerable. This feature establishes the event journal — an append-only SQLite
event log with a same-transaction current-state projection — as the first piece of
authoritative state Minna owns, and proves the mechanism end-to-end with the
smallest possible projection. Every later M1/M2 feature (checkpoints, agent runs,
reviews, the full work-item state machine) writes to this journal; this spec does
not define their event types or projections.

## Scope

### In scope

- The `events` table: append-only, monotonically-ordered, never updated or
  deleted.
- The event envelope: `id`, `timestamp`, `actor`, `type`, `payload` (see Data
  Considerations).
- Exactly two event types — `feature.created` and `feature.status_updated` — the
  minimal set needed to prove creation and mutation both project correctly.
- The `features` current-state projection table: `id`, `title`, `status`,
  `created_at`, `updated_at`. A bare identity table, not the legacy `FeatureState`
  shape (no `phase`, `decisions`, `manualTests`, `github` — those are M2 concerns).
  The `status` is a required, caller-supplied string (no journal-side default) on creation.
- A same-transaction write path: recording an event and updating its projection
  row happen in one SQLite transaction; a mutation without its paired event, or
  vice versa, is impossible by construction. The write API provides an explicit
  fault-injection seam for testing mid-transaction rollback.
- `minna log [--feature <id>]` — ordered, human-readable timeline.
- `minna verify` — re-derive the `features` projection from the event log from
  scratch, diff it against the stored projection, and additionally confirm every
  stored row traces to EXACTLY ONE `feature.created` event. Reports and exits non-zero
  on any drift or violation.
- `minna export --feature <id> <dir>` — render the feature's timeline as Markdown
  to `<dir>/journal.md`, creating `<dir>` if it does not exist.
- A minimal library write API (`recordEvent`-style with a fault injection callback or option)
  used by later features; this spec only needs enough of a command surface to prove the
  write path, not a full authoring UX.

### Non-goals

- Checkpoints and any git operations (002).
- Running agents or adapters (003).
- The full work-item state machine, `phase`/workflow transitions, decisions,
  manual test results, or GitHub linkage (M2/004) — these belong to the legacy
  `FeatureState` shape being superseded, not to this feature.
- Integration of the existing `start-feature` CLI command, decision/manual-test recording,
  and workflow phase-machine coupling are deferred entirely to M2. For M1, these legacy
  state-mutating CLI commands and their corresponding MCP tools (`start_feature`, `record_decision`,
  `record_manual_test`) are disabled (exiting non-zero or returning an error) to prevent
  split-state authoritative paths. The legacy state file `state/features.json` is treated as a read-only
  deprecated archive; 001 creates features in the SQLite database only via the database library write API.
- Findings, reviews, approvals (M2/006–007).
- Multi-project or multi-operator concerns; concurrent writers to `.minna/minna.db`
  are explicitly out of scope (Const. VI: single-operator workflows first).
- Any migration/replay framework beyond the `verify` consistency check — this is a
  pragmatic journal, not full event sourcing. Projection-rebuild-as-recovery
  (writing the re-derived projection back over a drifted one) is not in scope;
  `verify` only reports drift, it does not repair it.
- A journal-enforced payload schema per event type — payload typing is a
  write-site (TypeScript) concern per the clarification above, not a runtime
  validation feature of the journal itself.
- JSONL or any second export format.

## Behavior

### `minna log [--feature <id>]`

- Prints all events (or only those for `<id>` if given) in ascending chronological
  (id) order.
- Each line shows at minimum: timestamp, actor, type, and a short payload summary.
- No events for a given `--feature <id>` that has never had a `feature.created`
  event → exit non-zero, "no such feature `<id>`".
- No events at all (empty journal, no `--feature` given) → prints a "no events"
  message and exits 0.

### `minna verify`

- Replays every event into a fresh in-memory (or scratch) projection and diffs it,
  field by field and row by row, against the stored `features` table.
- Confirms every row in the stored `features` table has EXACTLY ONE
  `feature.created` event with a matching `id` in the log. Any duplicate creation
  events or missing creation events in the log trigger a validation failure.
- Clean state → exits 0, reports no drift.
- Any structural mismatch (missing row, extra row, field value disagreement) →
  exits non-zero, names the row id and the specific field(s) that disagree
  (stored value vs re-derived value).
- Any row with no creating event → exits non-zero, names the offending row id and
  reports the invariant violation explicitly (distinct from a structural-drift
  message).

### `minna export --feature <id> <dir>`

- Creates `<dir>` if it does not already exist.
- Writes `<dir>/journal.md`: a Markdown-rendered, chronologically-ordered timeline
  of every event for `<id>` (same content as `minna log --feature <id>`, rendered
  as committable prose/table rather than terminal output).
- `<id>` has no `feature.created` event → exit non-zero, "no such feature `<id>`",
  no file written.

### Write path (library API, no dedicated CLI command in this spec)

- Recording `feature.created` inserts one `events` row and one `features` row in a
  single transaction. The caller must supply a custom initial status (no default). At
  creation, `updated_at == created_at`.
- Writing `feature.created` for an existing `id` fails closed: the transaction is rejected
  and no events or projection rows are written.
- Recording `feature.status_updated` inserts one `events` row and updates the
  matching `features` row's `status` and `updated_at` in the same transaction.
- Writing an event for an `id` that was never created (an update with no prior
  `feature.created`) fails closed: the transaction is rejected and neither the
  event nor a projection row is written.
- To enforce the append-only constraint at the database layer (preventing data-tampering bypasses),
  the database initializes SQL triggers on `events` that abort any attempted `UPDATE` or `DELETE`
  statement and fully roll back the transaction with a SQLite error.
- The public `recordEvent` API does not expose transaction-corruption capabilities. Instead,
  a separate test-only function `_recordEvent` is exported for unit testing, which accepts
  a `faultInjection` option to trigger an error post-event-write, prior to committing or writing the projection.

## Acceptance Criteria

1. **Ordered, filterable log.**
   Given a sequence of recorded events for a feature, when `minna log --feature
   <id>` runs, then it prints them in ascending chronological order with correct
   timestamp/actor/type for each.
   **Independent Test**: seed N events for `<id>` via the write API against a
   scratch `.minna/minna.db`, run `minna log --feature <id>`, assert output order
   and fields match the seeded sequence.

2. **Same-transaction write, all-or-nothing.**
   Given a write-path call that fails partway through (leveraging the fault-injection
   parameter to throw an error after inserting the event but before updating the projection),
   when the transaction fails, then neither the `events` row nor the `features` change is persisted.
   **Independent Test**: trigger the fault-injection seam during feature creation/update;
   assert the `events` table row count and `features` row are unchanged afterward (both-or-neither).

3. **Clean journal passes verification.**
   Given a valid sequence of events with a matching projection, when `minna
   verify` runs, then it exits 0 and reports no drift.
   **Independent Test**: seed a consistent sequence, run `minna verify`, assert
   exit code 0.

4. **Verify catches structural drift.**
   Given a `features` row mutated directly (bypassing the write API, e.g. a raw
   `UPDATE features SET status = ...`), when `minna verify` runs, then it exits
   non-zero and names the row id and field that disagree with the re-derived
   value.
   **Independent Test**: seed a consistent sequence, directly mutate one stored
   field, run `minna verify`, assert non-zero exit and the reported row/field
   match the introduced drift.

5. **Verify catches an orphan or multi-created projection row.**
   Given a `features` row with either zero or more than one `feature.created` events,
   when `minna verify` runs, then it exits non-zero and reports the violation.
   **Independent Test**: insert a `features` row via raw SQL with no matching
   event, or insert two `feature.created` events for the same `id` (using raw SQL
   to bypass checks), run `minna verify`, assert non-zero exit and the reported violation
   names that row id.

6. **Export produces a committable timeline.**
   Given a feature with recorded events, when `minna export --feature <id> <dir>`
   runs, then `<dir>/journal.md` exists, is plain-text Markdown, and its content
   matches the event sequence for `<id>`.
   **Independent Test**: seed events for `<id>`, run `minna export --feature <id>
   <dir>` against a scratch directory, assert the file exists and its rendered
   content matches the seeded events; assert it is valid UTF-8 text (not binary).

7. **Fail-closed on an update with no prior creation.**
   Given no `feature.created` event exists for `<id>`, when the write API is
   asked to record `feature.status_updated` for `<id>`, then the call is rejected
   and no `events` row or `features` row is written.
   **Independent Test**: call the write API with `feature.status_updated` for an
   unknown `<id>` against a scratch database; assert it throws/rejects and the
   `events`/`features` tables are unchanged.

8. **Fail-closed on duplicate creation.**
   Given a `feature.created` event already exists for `<id>`, when the write API is
   asked to record `feature.created` for `<id>`, then the call is rejected and no new
   `events` row or `features` row is written.
   **Independent Test**: call `createFeature` twice with the same `<id>`; assert the second
   call throws/rejects and does not append a duplicate event or duplicate features row.

## Edge Cases and Failure Modes

- **Empty journal**: `minna log` with no `--feature` and no events recorded yet →
  a clear "no events" message, exit 0 (not an error).
- **Unknown feature id**: `minna log --feature <id>` / `minna export --feature
  <id> <dir>` where `<id>` has no `feature.created` event → exit non-zero, "no
  such feature `<id>`". Distinguish this from "feature exists but has zero
  events," which cannot occur since creation itself is an event.
- Update before create: see Acceptance Criterion 7 — fail closed, no partial write.
- Duplicate creation: see Acceptance Criterion 8 — fail closed, no duplicate event or row.
- **Direct database tampering**: anything that bypasses the write API (manual SQL
  against `.minna/minna.db`) is exactly what `minna verify` exists to catch; it is
  not prevented, only detected (consistent with Const. XIV's "detection, not
  prevention" bar for scope escape).
- **Corrupt or unreadable `.minna/minna.db`**: any command fails closed with a
  clear error identifying the file and the failure; no command attempts to
  silently recreate or repair the database.
- **Concurrent writers**: not handled in this feature. Single-operator,
  single-writer is the assumed model (Const. VI); documented as a known
  limitation, not solved here.
- **Process killed mid-write**: SQLite transaction durability guarantees that on
  restart the database reflects either the pre-write or fully-post-write state,
  never a partial event-without-projection (or projection-without-event) state.
  This is the property Acceptance Criterion 2 verifies.
- **`minna export` target directory already contains a `journal.md`**: the file is
  overwritten with the freshly rendered timeline (export is idempotent/derivable
  from the journal, matching Const. VI — it is not the second copy of
  authoritative state, it is a disposable rendering of it).

## Data Considerations

### `events` table (append-only)

| Column      | Type                          | Notes                                                                 |
|-------------|-------------------------------|------------------------------------------------------------------------|
| `id`        | integer, primary key           | Monotonic, assigned by SQLite; the append-only ordering key.          |
| `timestamp` | text (ISO 8601, UTC)           | Set at write time by Minna, never by the caller.                     |
| `actor`     | text                            | `"human"`, `"system"`, or an agent-id string. Not DB-enforced as an enum; conventions are enforced by write-site TypeScript types (Const. XVI: agent identifiers/telemetry are not uniform). |
| `type`      | text                            | Dot-namespaced: `feature.created`, `feature.status_updated`.          |
| `payload`   | text (JSON)                    | Opaque to the journal layer — stored and returned as-is, never parsed or schema-validated by journal code. Each write-site function constructs a typed payload object before serializing. |

Rows are never updated or deleted after insert (Const. III).

### `features` table (current-state projection)

| Column       | Type   | Notes                                                              |
|--------------|--------|----------------------------------------------------------------------|
| `id`         | text, primary key | Matches the `id` in `feature.created`'s payload.               |
| `title`      | text   | Set at creation, immutable in this feature's event set.             |
| `status`     | text   | Generic, caller-supplied string. Required parameter at creation (no default). The journal does not interpret its values — no enum, no default beyond what the creating event provides. Domain meaning (e.g. workflow phase) is out of scope; a later feature may layer that on top. |
| `created_at` | text (ISO 8601, UTC) | Copied from the `feature.created` event's `timestamp`.  |
| `updated_at` | text (ISO 8601, UTC) | Set to the `timestamp` of the most recent event affecting this row (`created` or `status_updated`). At feature.created, updated_at == created_at. |

### Relationship (events → projection)

- The `features` table is fully re-derivable by folding, in `id` order, every
  `events` row whose `type` is `feature.created` or `feature.status_updated` and
  whose `payload.id` matches: `feature.created` establishes the row; each
  subsequent `feature.status_updated` for the same id updates `status` and
  `updated_at`.
- `minna verify` performs exactly this fold from a clean slate and compares the
  result to the stored `features` table (Acceptance Criteria 3–5).
- This table intentionally does **not** carry `phase`, `decisions`,
  `manualTests`, or `github` — the shape currently in `src/core/types.ts`'s
  `FeatureState`. This feature supersedes the file-backed `src/core/state.ts`
  model at the persistence-mechanism level; it does not yet reintroduce that
  model's domain fields on top of the journal. That is explicitly deferred to
  M2/004.
