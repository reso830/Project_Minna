# Data Model: Git Checkpoints

This document defines the event formats, storage strategy, and state management for the **Git Checkpoints** feature.

## 1. Storage Strategy & Architecture

Unlike the Event Journal, Git Checkpoints do not introduce new SQLite database tables. 
Instead, the git repository itself serves as the database for worktree snapshots, utilizing git's native object graph and reference store:

* **Object Storage**: The snapshot is stored as a standard, dangling git commit object in the repository's object database. It has `HEAD` as its parent, ensuring it captures the divergence from the current branch status without moving `HEAD` itself.
  - **Commit Parent**: The base commit (commit before checkpoint) is stored natively as the commit parent (resolvable via `git rev-parse <ref>^1`).
  - **Commit Date**: The checkpoint creation timestamp is stored natively as the commit author/committer date.
  - **Commit Message & Trailers**: Minna semantic metadata is stored as standard Git Trailers in the commit message body:
    ```text
    minna checkpoint: <context-type>/<id>/<seq>

    Minna-Context-Type: <context-type>
    Minna-Context-Id: <id>
    Minna-Sequence: <seq>
    Minna-Reason: <message>
    ```
    These trailers are parseable using `git log --format="%(trailers)"` and are bound directly to the commit object.
* **Index/Reference Store**: Checkpoints are indexed using custom git refs under the namespace:
  `refs/minna/checkpoints/<context-type>/<id>/<seq>`
  where:
  - `<context-type>`: The context in which the checkpoint was created (e.g., `manual`, `pre-restore`).
  - `<id>`: A timestamp-based grouping identifier (`YYYYMMDD-HHMMSS`).
  - `<seq>`: A monotonic sequence number starting at `1` for each `<id>`.
* **State Projections**: There are no SQLite database projections. Live checkpoint listings and validations query the git reference store directly (e.g., via `git for-each-ref` or `git show-ref`).

The SQLite database (`.minna/minna.db`) event log is used solely as an audit journal, recording when snapshots are created or restored.

---

## 2. Event Payload Contracts

Three new event types are recorded in the append-only SQLite `events` journal to trace checkpoint operations.

### Event Type: `git.snapshot_created`

Recorded whenever a new checkpoint (manual or automatic safety checkpoint) is successfully created.

* **Payload Structure**:
  ```json
  {
    "ref": "refs/minna/checkpoints/manual/20260718-143052/1",
    "contextType": "manual",
    "id": "20260718-143052",
    "seq": 1,
    "commitHash": "8a32d18b45689ef2c3d0f7a6a43d9b4b02b5e28a",
    "parentHash": "2f10b7d6c6e30ab5f381c1c7a8b417e29606d15a",
    "message": "Manual checkpoint before major change"
  }
  ```

* **TypeScript Interface**:
  ```typescript
  interface GitSnapshotCreatedPayload {
    ref: string;
    contextType: "manual" | "pre-restore";
    id: string;
    seq: number;
    commitHash: string;
    parentHash: string;
    message: string;
  }
  ```

### Event Type: `git.snapshot_restored`

Recorded whenever the worktree is restored to a checkpoint state.

* **Payload Structure**:
  ```json
  {
    "ref": "refs/minna/checkpoints/manual/20260718-143052/1",
    "safetyRef": "refs/minna/checkpoints/pre-restore/20260718-143210/1",
    "commitHash": "8a32d18b45689ef2c3d0f7a6a43d9b4b02b5e28a"
  }
  ```

* **TypeScript Interface**:
  ```typescript
  interface GitSnapshotRestoredPayload {
    ref: string;
    safetyRef: string | null; // Safety checkpoint ref created before restore, or null if worktree was clean
    commitHash: string;
  }
  ```

### Event Type: `git.snapshot_create_failed`

Recorded as a compensating event if a git reference update fails (e.g. sequence collision) after the `git.snapshot_created` event has already been committed to the database.

* **Payload Structure**:
  ```json
  {
    "contextType": "manual",
    "id": "20260718-143052",
    "seq": 1,
    "commitHash": "8a32d18b45689ef2c3d0f7a6a43d9b4b02b5e28a",
    "error": "Sequence collision: ref refs/minna/checkpoints/manual/20260718-143052/1 already exists"
  }
  ```

* **TypeScript Interface**:
  ```typescript
  interface GitSnapshotCreateFailedPayload {
    contextType: "manual" | "pre-restore";
    id: string;
    seq: number;
    commitHash: string; // The dangling commit object that was created
    error: string; // Representation of the git error
  }
  ```

---

## 3. Reference Namespace Schemes

The ref namespace grows logically with Minna's feature roadmap:

| Context Type | Ref Prefix | Purpose | Introduced In |
|---|---|---|---|
| `manual` | `refs/minna/checkpoints/manual/<id>/<seq>` | User-triggered checkpoints | 002 (This feature) |
| `pre-restore` | `refs/minna/checkpoints/pre-restore/<id>/<seq>` | Safety checkpoints before restore | 002 (This feature) |
| `run` | `refs/minna/checkpoints/run/<runId>/<seq>` | Before/after checkpoints for agent runs | 003 (Follow-up) |
| `feature` | `refs/minna/checkpoints/feature/<featureId>/<seq>` | Work-item checkpoints | M2 (Follow-up) |

---

## 4. Integrity and Consistency Invariants

1. **Create-Only Refs**: When writing a checkpoint ref, the `git update-ref` command must be invoked with an old value of `0000000000000000000000000000000000000000` (or similar lock-empty validation) to ensure that if a sequence collision occurs, git aborts rather than overwriting an existing ref (Article XIV).
2. **Atomicity & Cleanup**: A temporary git index file (e.g. `.git/index-minna-checkpoint-<random>`) is used for adding tracked/ignored/untracked files. This index file MUST be deleted in a `finally` block on both success and failure, ensuring no lock contention or leak of temporary files.
3. **No Branch/HEAD Alteration**: Checkpoint operations must not alter the active branch ref, `HEAD` position, or the primary git index file (`.git/index`).
4. **Audit Trail & Ref Durability Ordering**: Every snapshot creation and restore operation must record a corresponding event in the SQLite database journal. To maintain strict cross-system consistency and ensure that a live git ref never exists without its audit record (Article XIII/III/XIV):
   - During checkpoint creation:
     1. Create the dangling checkpoint commit.
     2. Write the SQLite journal event `git.snapshot_created` and commit it (rendering the event durable first).
     3. Write the git reference `git update-ref refs/minna/checkpoints/... <commit-sha> 0000000000000000000000000000000000000000`.
     4. If the git ref update fails (e.g. sequence collision), append a compensating event `git.snapshot_create_failed` (referencing the original snapshot's context type, ID, sequence, and error) to the SQLite database journal. Do **never** update or delete the already committed `git.snapshot_created` event (adhering to the append-only event invariant in Article III). Then propagate the git error.
   - **Crash-Resilience Invariant**: By writing and committing the database event *before* creating the git reference:
     - A hard process crash (e.g. OOM, power loss) after step 2 but before step 3 results in a database event without a git ref. This is a harmless incomplete attempt (reconciliation and cleanup deferred to Feature 010 / M2).
     - A crash can *never* leave a live, usable git checkpoint reference without a corresponding durable journal event. The "no ref without an event" invariant is structurally guaranteed under all failure and crash modes.

    - During checkpoint restoration:
      - The `git.snapshot_restored` event is written best-effort *after* the (irreversible) restore completes. If the database write fails, the CLI reports `"Error: restore succeeded; audit event failed to record"` to stderr and exits `0` (success) rather than throwing an error as if restore itself failed. Detecting restore-without-event anomalies via `minna verify` is deferred (out of scope for 002).

5. **Verification & Replay Semantics (`verifyDb`)**: The database fold/replay function (`verifyDb`) checks the log consistency of checkpoint events:
   - For every `git.snapshot_created` event:
     - Check if a corresponding compensating `git.snapshot_create_failed` event exists for the same `contextType`, `id`, `seq`, and `commitHash`.
     - If a `git.snapshot_create_failed` exists matching the exact `commitHash`, the checkpoint attempt is considered **aborted/failed** and that specific commit is expected **not** to be referenced by the git ref.
     - If no `git.snapshot_create_failed` exists matching the `commitHash`, the checkpoint is considered **active** and `verifyDb` verifies that the git ref `refs/minna/checkpoints/<contextType>/<id>/<seq>` actually resolves in the repository and matches the `commitHash`. Any discrepancy (such as the ref resolving to a different hash, or not resolving at all) is reported as database-to-git drift, failing the verification.
     - (Note: On a sequence collision path, the database will contain a successful `git.snapshot_created` and a failed `git.snapshot_created` under the same sequence; matching with `commitHash` prevents the failure event of the collision attempt from incorrectly invalidating the original successful checkpoint).
