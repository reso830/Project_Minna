# Feature Specification: Git Checkpoints

**Feature Branch**: `002-git-checkpoints`  
**Created**: 2026-07-18  
**Status**: Draft  
**Input**: `docs/features/1.0.0-safety-net/002-git-checkpoints.md`

## Clarifications

### Session 2026-07-18

- **Q1: What namespace/key scheme should be used for refs when there is no active feature context?**
  - **A1**: Checkpoint refs are namespaced by context-type as the first path segment. Context-free checkpoints use `manual/` as the context-type, resulting in:
    `refs/minna/checkpoints/manual/<id>/<seq>`
    where `<id>` is a short timestamp-based identifier (e.g. `20260718-143052`). This is the only context-type 002 needs. The scheme is designed to extend without restructuring: feature 003 will add `run/<runId>/<seq>` (checkpoints around an agent run), and M2 will add `feature/<featureId>/<seq>`. We do not implement `run/` or `feature/` in 002—just structure the namespace to support them. Within any namespace, sequence stays monotonic and create-only per Article XIV (never overwrite an existing ref).
    *Rejected option 1 (default namespace)*: a single shared bucket accumulates unrelated checkpoints forever with a global sequence counter, becoming an untraceable junk drawer.
    *Rejected option 3 (require feature context)*: 002 ships before the work-item engine exists (M2), so feature context usually does not exist yet—requiring it would make `minna checkpoint` unusable in the M1 scenario it's built for.

- **Q2: How should the restore command handle a dirty worktree?**
  - **A2**: Restore on a dirty worktree first checkpoints the dirty state (using 002's dangling-commit mechanism—capturing staged, unstaged, untracked, and configured gitignored paths), then restores the target.
    - The safety checkpoint is written to its own namespace: `refs/minna/checkpoints/pre-restore/<id>/<seq>`, making it clearly identifiable.
    - The command output must announce the saved ref and how to recover it: e.g., `"Saved uncommitted changes to pre-restore/<id>; recover with minna restore <ref>"`.
    - The safety checkpoint is recorded as a journal event (`git.snapshot_created`).
    *Rejected option 3 (force/discard)*: this would reproduce the founding incident of destroying uncommitted work, which is constitutionally forbidden (Article XIV).
    *Rejected option 2 (refuse if dirty)*: safe but defeats restore's main purpose (recovering from a mess). A safety checkpoint satisfies fail-closed while keeping restore usable.

- **Q3: Where should the checkpoint restore operation output files?**
  - **A3**: Restore writes directly into the active worktree, content unstaged (Article XIV, M0/B6—single-tree restore does not preserve index state; documented, not a defect). The writing logic should remain factorable to allow a `--to <path>` variant later.
    *Rejected option 2 (restore to separate path)*: restoring to a separate path is a distinct future capability (inspect/extract without disturbing current work), deferred from 002's core restore.

- **Q4: Should checkpoint pruning/garbage collection be implemented in this phase?**
  - **A4**: Fully deferred from 002—tracked as a follow-up feature. Pruning removes recoverability (Article XIV) and needs deliberate design, including determining which namespaces are prunable (notably NOT `pre-restore/` safety checkpoints). Checkpoints are cheap dangling commits; no scale pressure exists yet.

- **Q5: How should metadata (timestamp, reason, base commit) be stored for each checkpoint?**
  - **A5**: Checkpoint metadata is stored in the git commit object itself to ensure it is self-describing, preventing a second desyncable source of truth (Article III/VI). Base commit matches the commit parent (`commit-tree -p HEAD`) and timestamp matches the commit date—both are native git properties and are NOT duplicated. Minna-specific metadata (context-type, context-id, sequence, reason) is stored in the commit message body as Git Trailers:
    - `Minna-Context-Type: <context-type>`
    - `Minna-Context-Id: <context-id>`
    - `Minna-Sequence: <seq>`
    - `Minna-Reason: <message>`
    This makes the metadata greppable via `git log --format="%(trailers)"` and ensures it travels with the commit.


- **Q6: Where should the checkpoint.includeIgnored paths be configured?**
  - **A6**: Read from project configuration (`minna.project.yaml` -> `project.checkpoint.includeIgnored`) to allow project-specific evolution of agent scratch spaces. Falls back to a minimal, conservative default (or empty list) to prevent over-capturing large or sensitive files.
    - **Tolerant Force-Add (M0/B1 / Article XIV)**: Checkpoint creation must force-add each configured ignored path *individually*, skipping any paths that do not exist on disk. A naive `git add -Af <missing>` exits 128 (fatal) and would crash the checkpoint operation; therefore, missing paths must be explicitly ignored/skipped.


---

## Problem Statement

Minna agents produce uncommitted work, and external branch operations or tool errors can easily destroy it. To prevent this, Minna must capture the complete state of a worktree (including staged, unstaged, untracked, and configured gitignored paths) as a recoverable dangling git commit before and after every agent run (003) and before destructive operations like restore. Checkpoints must be non-invasive, monotonic, addressable, and impossible to accidentally overwrite. Every checkpoint operation must write to the SQLite event journal (001) for auditability.

---

## Scope

### In scope

- **Monotonic, create-only checkpoint refs**:
  - Refs use the namespace pattern: `refs/minna/checkpoints/<context-type>/<id>/<seq>`.
  - Context-types supported in 002: `manual` (context-free, user-triggered checkpoints) and `pre-restore` (automatic safety checkpoints before restore).
  - Sequence generation: parse existing refs under `refs/minna/checkpoints/<context-type>/<id>/` to compute the next sequential number. Do not rely on string length or simple count; read and parse the sequence numbers.
  - Ref updates use `git update-ref` with create-only semantics (ensuring we fail if the ref already exists, preventing overwriting).
- **Non-invasive checkpoint creation (`createCheckpoint`)**:
  - Operates using a temporary git index to leave the main index and HEAD undisturbed.
  - Basic workflow:
    1. Define and write a temporary index file.
    2. Read HEAD into the temporary index (`read-tree`).
    3. Add all worktree files (`add -A`).
    4. Force-add configured `includeIgnored` paths that exist (skip/tolerate missing).
    5. Write the tree (`write-tree`).
    6. Commit the tree (`commit-tree`) with `HEAD` as parent.
    7. Update the ref `refs/minna/checkpoints/<context-type>/<id>/<seq>`.
  - Cleanup of temporary index files in a `finally` block (success and failure).
- **Core CLI Commands**:
  - `minna checkpoint [--message <msg>]`: Create a checkpoint under the `manual` namespace with a timestamp-based ID.
  - `minna checkpoints [--context-type <type>] [--id <id>]`: List checkpoint refs with metadata (base commit, timestamp, reason/message).
  - `minna restore <ref>`: Restore worktree from checkpoint (content unstaged). First checkpoints dirty worktree to `pre-restore` namespace if dirty.
- **Journal Integration**:
  - Create checkpoint emits `git.snapshot_created` event to the SQLite database journal.
  - Restore checkpoint emits `git.snapshot_restored` event to the SQLite database journal.

### Non-goals

- Checkpoints around agent runs (deferred to 003).
- Scope-escape detection (deferred to 003).
- Index preservation (M0/B6: rejected. Document restore-as-unstaged).
- Checkpoint pruning/GC policy (deferred).
- Worktree creation/management (deferred to M2).

---

## Behavior

### `minna checkpoint [--message <msg>]`
- Triggers creation of a manual checkpoint.
- Auto-generates a timestamp-based ID: `<id> = YYYYMMDD-HHMMSS` (e.g., `20260718-143052`).
- Resolves the next monotonic sequence `<seq>` starting at `1` for this `<id>`.
- Creates a dangling commit pointing to the current worktree (staged + unstaged + untracked + configured ignored files).
- Updates ref `refs/minna/checkpoints/manual/<id>/<seq>`.
- Emits a `git.snapshot_created` event to the event journal.
- Outputs success message containing the generated ref.

### `minna checkpoints [--context-type <type>] [--id <id>]`
- Lists all checkpoint refs under `refs/minna/checkpoints/`.
- Allows filtering by `<context-type>` (e.g. `manual`, `pre-restore`) and `<id>`.
- For each checkpoint, displays the full ref name, date/time, parent/base commit, and message.

### `minna restore <ref>`
- Restores the worktree to the state captured in `<ref>`.
- **Dirty check**: If `git status --porcelain` or check of configured ignored paths indicates any staged, unstaged, untracked, or modified ignored changes:
  1. Creates a safety checkpoint under `refs/minna/checkpoints/pre-restore/<id>/1`.
  2. Announces the safety checkpoint ref to the user.
  3. Records the safety checkpoint `git.snapshot_created` event in the journal.
- Performs restoration of files to the worktree (content unstaged).
- Emits `git.snapshot_restored` event to the journal.
- Outputs confirmation of successful restore.

---

## Requirements

### Functional Requirements

- **FR-001**: Checkpoint operations MUST capture staged, unstaged, untracked, and configured `includeIgnored` files.
- **FR-002**: Force-adding a configured ignored path that does not exist MUST be tolerated (skipped/logged, not fatal).
- **FR-003**: Checkpoint creation MUST be non-invasive: HEAD, the current branch ref, the working directory, and the active index must remain undisturbed.
- **FR-004**: Checkpoint refs MUST be monotonic and create-only, preventing any bad sequence calculation from overwriting an existing ref.
- **FR-005**: Restore operations on a dirty worktree MUST first capture the dirty state in `refs/minna/checkpoints/pre-restore/<id>/<seq>` before modifying the worktree.
- **FR-006**: Restore operations MUST write files into the active worktree as unstaged content.
- **FR-007**: Every checkpoint creation and restore MUST record a corresponding event (`git.snapshot_created`, `git.snapshot_restored`) in the SQLite database journal.
- **FR-008**: Temporary git index files MUST be cleaned up on both success and failure.
- **FR-009**: Checkpoint failures MUST fail closed, surfacing as explicit errors rather than returning silent nulls or success statuses.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Restoring a checkpoint reproduces 100% of the captured files (staged, unstaged, untracked, and ignored) as unstaged files in the worktree.
- **SC-002**: Verification of non-invasiveness: running a checkpoint does not change `git rev-parse HEAD` or the output of `git status` (except for the presence of temporary files during execution).
- **SC-003**: Verification of safety checkpoint: restoring onto a dirty worktree successfully saves the dirty state, which can then be fully restored itself.
- **SC-004**: No temporary git index files remain in the temp directory or repository root after any checkpoint operation finishes (successful or failed).
- **SC-005**: Verification of ignored-path tolerance: the checkpoint successfully completes and creates a ref even if configured includeIgnored paths do not exist on disk.
- **SC-006**: Monotonic create-only verification: attempting to update a ref with an already existing sequence number fails with a git update-ref error and does not overwrite the existing checkpoint.
- **SC-007**: Journal event logging verification: every checkpoint creation and restore logs a valid event envelope and JSON payload to the SQLite events table.
- **SC-008**: Fail-closed consistency verification: if the initial database event write fails, the operation aborts and no git reference is created. If a git reference update fails, the original database event remains intact and a compensating `git.snapshot_create_failed` event is appended to the journal, leaving no live git checkpoint reference (Article III).

---

## Assumptions

- **Git Version Compatibility**: The host system has a git client installed that supports `git update-ref`, `git write-tree`, `git commit-tree`, and custom git index file environment variables (`GIT_INDEX_FILE`).
- **Single-operator execution**: No concurrent CLI invocations will attempt to write checkpoints or modify the database at the same instant (consistent with Constitution Article VI).
- **Journal Availability**: The SQLite event journal database is initialized and functional.
- **Existing Commit Requirement**: Checkpoints require at least one existing commit in the repository. Newly initialized repositories with zero commits (unborn HEAD) are unsupported.
