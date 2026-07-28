# Tasks: Git Checkpoints

## Conventions

* **Status Legend**: `[ ]` pending · `[x]` done · `[~]` skipped
* **Parallel Marker `[P]`**: Can run in parallel (different files, no shared edits)
* **Phase Dependency**: `01 -> 02 -> 03 -> 04 -> 05 -> 06`
* **Project Commands**:
  - Build: `npm run build`
  - Run tests: `npm run test`
  - Run CLI dev: `npm run dev`
  - TypeScript typecheck: `npx tsc --noEmit`

---

## Phase Summary Table

| Phase | Focus/Name | Task ID Range | Stories / Requirements Covered |
|---|---|---|---|
| 01 | Setup & Types | T001 - T003 | — (Foundational Prerequisite) |
| 02 | Core Checkpoint Engine | T004 - T007 | FR-001, FR-002, FR-003, FR-004, FR-007, FR-008, FR-009 (Create/List logic) |
| 03 | Worktree Restoration | T008 - T011 | FR-005, FR-006, FR-007, FR-009 (Restore logic & safety checkpoints) |
| 04 | CLI Commands | T012 - T014 | `minna checkpoint`, `minna checkpoints`, `minna restore` commands |
| 05 | Workflow Smoke Test | T015 | — (Gate Verification) |
| 06 | Release Prep | T016 - T020 | — (Governance & Release) |

---

## Phase 01: Setup & Types

**Purpose**: Configure typescript interfaces and register checkpoint journal event types.

- [ ] **T001** `[P]` **[Setup] Define types for checkpoint metadata, creation options, and events in `src/core/types.ts`**
  - *Target File*: `src/core/types.ts`
  - *Expected Behavior*: Define typescript interfaces:
    - `CheckpointContextType = "manual" | "pre-restore" | "run" | "feature"`
    - `CheckpointMetadata` (contains ref, contextType, id, seq, commitHash, parentHash, message, timestamp)
    - `CreateCheckpointOptions`
    - `GitSnapshotCreatedPayload`, `GitSnapshotRestoredPayload`, and `GitSnapshotCreateFailedPayload` event payload structures
  - *Constraints*: No new external npm dependencies. Ensure strict ESM compatibility.
  - *Validation*: Run `npx tsc --noEmit`.
  - *Out of Scope*: Database schemas and validation triggers (001 concerns).

- [ ] **T002** **[Setup] Register checkpoint events in journal validation list**
  - *Target File*: `src/core/db.ts`
  - *Expected Behavior*: Update the `verifyDb` and event-parsing logic to support and accept `git.snapshot_created`, `git.snapshot_restored`, and `git.snapshot_create_failed` as valid event type strings, so `minna verify` does not crash on checkpoint-related journal entries.
  - *Constraints*: Do not alter features-projection logic (which is solely for feature status).
  - *Validation*: Run database unit tests: `npm run test`.

- [ ] **T003** **[Setup] Initialize unit test file for checkpoints**
  - *Target File*: `src/core/checkpoints.test.ts`
  - *Expected Behavior*: Setup a basic test boilerplate imports (`node:test`, `node:assert/strict`) and verify testing runner runs it cleanly.
  - *Constraints*: Use native test runner (`node --test`). In the test suite setup (`before` or `beforeEach` hook), create a temporary scratch directory (e.g. via `fs.mkdtemp`), initialize it as a fresh Git repository (`git init`), configure basic git user name/email, and direct all tests to execute git commands within this isolated fixture repository. The host Project Minna repository must never be written to or modified by the tests.
  - *Validation*: Run `npm run test`.

---

## Phase 02: Core Checkpoint Engine

**Purpose**: Implement checkpoint creation, listing, sequence lookup, and temporary index handling.

**⚠️ CRITICAL**: The test suite must pass and compile after every task. Test tasks are written first and run in Red phase.

- [ ] **T004** **[FR-001] Write unit tests FIRST for checkpoint creation and listing**
  - *Target File*: `src/core/checkpoints.test.ts`
  - *Expected Behavior*:
    1. Test that `createCheckpoint` successfully generates a dangling git commit capturing unstaged, staged, untracked, and ignored paths.
    2. Test non-invasiveness: verify `HEAD`, current branch ref, and main index are untouched.
    3. Test monotonic sequence generation: creating two checkpoints under same group ID increments `<seq>` cleanly (1, then 2).
    4. Test create-only ref update: verify trying to write a ref that already exists throws an error and does not overwrite.
    5. Test ignore paths toleration: verify configured paths that do not exist on disk are tolerantly skipped without crashing checkpointing.
    6. Test temporary index cleanup: verify temporary index files are deleted on success and failure.
    7. Test database event logging: verify `git.snapshot_created` is written in database journal.
    8. Test cross-system consistency rollback: mock a git reference update failure, and assert that a compensating `git.snapshot_create_failed` event is appended to the SQLite database (referencing the original event), and that the original `git.snapshot_created` event remains intact in the database (never deleted).
    9. Test isolated execution: assert that all git actions run inside the dynamically initialized fixture repository, leaving Project Minna's main repository `.git` untouched.
  - *Validation*: Run `npm run test` and assert new tests fail (Red).

- [ ] **T005** **[FR-001] Implement `createCheckpoint` core engine**
  - *Target File*: `src/core/checkpoints.ts` (New file)
  - *Expected Behavior*:
    - Execute git commands using `node:child_process` (such as `execFile` or `spawnSync`).
    - Resolve group ID (default to current timestamp `YYYYMMDD-HHMMSS` if missing).
    - Query existing refs under `refs/minna/checkpoints/<context-type>/<id>/` to compute next monotonic sequence `<seq>`.
    - Setup temporary git index file path: `.git/index-minna-checkpoint-<random>`.
    - Inside `try-catch-finally` block:
      1. Run `git read-tree HEAD` on the temporary index.
      2. Run `git add -A` to stage all working directory changes in the temporary index.
      3. Read project config (`minna.project.yaml` -> `project.checkpoint.includeIgnored`). For each path that exists on disk, run `git add -f <path>`. Skip missing paths without throwing.
      4. Run `git write-tree` to write the tree.
      5. Run `git commit-tree <tree-sha> -p HEAD -m <message>` where `<message>` incorporates Minna trailers (`Minna-Context-Type`, `Minna-Context-Id`, `Minna-Sequence`, `Minna-Reason`).
      6. Record `git.snapshot_created` in the SQLite database journal (committed immediately to ensure durability).
      7. Run `git update-ref refs/minna/checkpoints/<context-type>/<id>/<seq> <commit-sha> 0000000000000000000000000000000000000000` (aborts if ref already exists).
      8. If the git reference update fails (e.g. sequence collision), append a compensating `git.snapshot_create_failed` event to the SQLite database journal and propagate the error (do **never** delete the committed `git.snapshot_created` row).
    - Inside `finally` block, delete the temporary git index file.
  - *Constraints*: No third-party git packages. Temporary index file must be completely deleted. Must fail closed (throw error) on any git error or ref collision.
  - *Validation*: Run `npm run test` (T004 tests pass).

- [ ] **T006** **[FR-004] Implement list checkpoints logic**
  - *Target File*: `src/core/checkpoints.ts`
  - *Expected Behavior*: Implement `listCheckpoints(options)` which runs `git for-each-ref refs/minna/checkpoints/`, retrieves the commit hashes, parses the author date (timestamp) and parent hash natively, and parses Minna trailers from the commit message body.
  - *Validation*: Compile and run `npx tsc --noEmit`.

- [ ] **T007** **[FR-004] Write and run unit tests for list checkpoints**
  - *Target File*: `src/core/checkpoints.test.ts`
  - *Expected Behavior*: Verify `listCheckpoints` correctly parses and returns the full list of metadata, sorting them chronologically and allowing filters on `contextType` and `id`.
  - *Validation*: Run `npm run test` and verify passes.

---

## Phase 03: Worktree Restoration

**Purpose**: Implement worktree restoration and pre-restore safety checkpoints.

- [ ] **T008** **[FR-005] Write unit tests FIRST for checkpoint restoration**
  - *Target File*: `src/core/checkpoints.test.ts`
  - *Expected Behavior*:
    1. Test that `restoreCheckpoint` restores files to the active worktree as unstaged files.
    2. Test index non-invasiveness: verify the primary index (run `git diff --cached`) is byte-identical before and after restore, and `HEAD` is unchanged.
    3. Test restore safety: when restoring on a dirty worktree (including staged, unstaged, untracked, or modified includeIgnored changes), verify it first automatically creates a safety checkpoint under `refs/minna/checkpoints/pre-restore/<id>/1`, logs the event, and continues to restore.
    4. Test deletion behavior: assert that a file present in the worktree but absent from the target checkpoint tree IS successfully deleted on restore.
    5. Test directory safety: assert that `.git/` and Minna-internal directories are completely untouched and never considered candidates for deletion during restore.
    6. Test ignored paths safety: assert that an unconfigured ignored file present on disk (not in `includeIgnored` config) is NOT deleted or affected by restore. Assert that configured ignored paths (in `includeIgnored`) present on disk ARE captured, restored, and deleted if absent from the checkpoint tree.
    7. Test database logging: verify `git.snapshot_restored` is logged.
    8. Test best-effort logging: mock database log write failure on restore, and assert that the restore operation still succeeds and exits `0` (warning printed to stderr).
  - *Validation*: Run `npm run test` and assert new tests fail (Red).

- [ ] **T009** **[FR-005] Implement `restoreCheckpoint` core engine**
  - *Target File*: `src/core/checkpoints.ts`
  - *Expected Behavior*:
    - Verify target ref/SHA exists.
    - Check if worktree is dirty: run `git status --porcelain --ignored`, and check if any staged, unstaged, untracked, or modified includeIgnored paths are present on disk.
    - If dirty:
      1. Trigger `createCheckpoint(db, { contextType: "pre-restore", message: "Safety checkpoint before restoring " + ref })`.
      2. Record safety checkpoint event `git.snapshot_created`.
    - Restore worktree contents (Index-Isolated Restore):
      1. Setup temporary index path: `.git/index-minna-restore-<random>`.
      2. In try-catch-finally block:
         - Run `git read-tree --index-output=<temp-index> <target-ref>` to read the target tree into the temporary index.
         - Run `git checkout-index -a -f -u` setting the environment variable `GIT_INDEX_FILE` to `<temp-index>` (checks out all files from the temporary index, overwriting files in the worktree unstaged).
         - Compute deletion set using git's file lists (never a filesystem walk):
           - **Candidate files**: tracked + untracked files (`git ls-files --cached --others --exclude-standard`) plus configured `includeIgnored` files existing on disk. Explicitly exclude `.git/` and any unconfigured ignored files.
           - **Checkpoint files**: `git ls-files` run with environment variable `GIT_INDEX_FILE` set to the temporary index.
           - **Deletion action**: Delete candidate files that do not appear in the checkpoint files.
      3. In the finally block, delete the temporary git index file.
    - Write event `git.snapshot_restored` to SQLite database journal. If this SQLite write fails, catch the error, print `"Error: restore succeeded; audit event failed to record"` to stderr, but do **not** fail the restore (best-effort write).
  - *Constraints*: Restored files must be written unstaged. Must allow factorable write logic to support a separate extraction path (`--to <path>`) in the future. Primary index and HEAD must be undisturbed.
  - *Validation*: Run `npm run test` (T008 tests pass).

- [ ] **T010** **[FR-005] Test event-first ordering and compensating failure events**
  - *Target File*: `src/core/checkpoints.test.ts`
  - *Expected Behavior*: Write tests asserting:
    1. If the initial event write (`git.snapshot_created`) to the SQLite database fails (e.g. mock a write error), the operation immediately aborts, and **no git reference is created**.
    2. If the event write succeeds but the git ref write fails (e.g. mock git reference update failure), verify that the original `git.snapshot_created` remains in the database and a compensating `git.snapshot_create_failed` event is appended referencing the original snapshot attempt.
  - *Validation*: Run `npm run test` and verify passes.

- [ ] **T011** **[FR-005] Clean up test environment databases and temp directories**
  - *Target File*: `src/core/checkpoints.test.ts`
  - *Expected Behavior*: Clean up and completely remove the temporary scratch directories created for the isolated git fixture repositories and test SQLite databases in a teardown `after()` hook.
  - *Validation*: Assert no dangling test directories or refs remain on the host system.

---

## Phase 04: CLI Commands

**Purpose**: Wire core checkpoint methods into the CLI interface.

- [ ] **T012** **[Setup] Register CLI commands in `src/cli.ts`**
  - *Target File*: `src/cli.ts`
  - *Expected Behavior*:
    - Route `checkpoint` command to create a manual checkpoint.
    - Route `checkpoints` command to list all checkpoints.
    - Route `restore` command to restore a checkpoint.
    - Update helper output `printHelp()` to describe these commands, flags, and usage.
  - *Validation*: Verify compilation: `npm run build`.

- [ ] **T013** **[Setup] Implement CLI command execution logic**
  - *Target File*: `src/cli.ts`
  - *Expected Behavior*:
    - `checkpoint [--message <msg>]`: Call `createCheckpoint` with `contextType = "manual"`. Print the generated ref on success.
    - `checkpoints [--context-type <type>] [--id <id>]`: Call `listCheckpoints`. Iterate and format each checkpoint as `ref | timestamp | parent | message` on stdout.
    - `restore <ref>`: Call `restoreCheckpoint`. If a safety checkpoint is generated, print the safety ref and recovery instructions first. Print restoration confirmation.
  - *Constraints*: Proper error parsing, print to stderr and exit `1` on error.
  - *Validation*: Manually verify by running the commands via `npm run dev`.

- [ ] **T014** **[Setup] Integrate SQLite verify mapping updates**
  - *Target File*: `src/core/db.ts`
  - *Expected Behavior*: Update `verifyDb` verification logic so that:
    1. Replaying `git.snapshot_created`, `git.snapshot_restored`, and `git.snapshot_create_failed` does not affect the projected `features` table.
    2. Validates that all three event types conform to their payload schemas and typescript interfaces.
    3. Implements log-replay validation: for each `git.snapshot_created` event, checks if a corresponding `git.snapshot_create_failed` event exists (matching same contextType, id, seq, and commitHash). If a failure event exists matching the exact `commitHash`, that specific commit attempt is considered aborted and we verify that the git ref does **not** point to it. If no failure event exists for a `commitHash`, verify that the git ref resolves to that expected `commitHash`, flagging any discrepancy as database-to-git drift. (Handles sequence collisions correctly by distinguishing success and failure hashes).
  - *Validation*: Run `npm run dev verify` and verify it passes. Write a unit test verifying this drift check.

---

## Phase 05: Workflow Smoke Test

**Purpose**: Execute scripted integration checks (smoke verification).

- [ ] **T015** **[Verify] Execute scripted Workflow Smoke Test**
  - *Target Files*: CLI environment
  - *Expected Behavior*: Run the following sequence and confirm expected results:
    1. Ensure working directory is clean, run `npm run dev checkpoint --message "Clean check"`. Confirm ref `refs/minna/checkpoints/manual/<timestamp>/1` is returned.
    2. Run `npm run dev checkpoints`. Confirm the checkpoint ref, parent SHA, and message are listed.
    3. Modify a file, and add a new untracked file.
    4. Run `npm run dev restore manual/<timestamp>/1`.
       - Confirm output prints: `Saved uncommitted changes to refs/minna/checkpoints/pre-restore/...`
       - Confirm output prints: `Worktree restored from manual/<timestamp>/1`
    5. Verify the worktree is clean (uncommitted edits discarded).
    6. Run `npm run dev checkpoints --context-type pre-restore`. Confirm the pre-restore safety checkpoint is listed.
    7. Run `npm run dev log`. Confirm the `git.snapshot_created` and `git.snapshot_restored` events are logged in the SQLite database.
    8. Run `npm run dev verify`. Confirm exits `0` with no database drift.
    9. Verify no temporary files remain in `.git/` or repository root.
  - *Validation*: All steps succeed as described.

---

## Phase 06: Release Prep

**Purpose**: Finalize roadmaps, changelogs, documentation, and versioning.

- [ ] **T016** **[Release] Update `CHANGELOG.md`**
  - *Target File*: `CHANGELOG.md`
  - *Expected Behavior*: Record release notes for v0.3.0 detailing Git Checkpoints, CLI commands (`checkpoint`, `checkpoints`, `restore`), pre-restore safety checkpoints, and Ignored paths integration.

- [ ] **T017** **[Release] Update feature roadmap status**
  - *Target File*: `docs/feature_roadmap.md`
  - *Expected Behavior*: Mark the git checkpoints feature row as completed.

- [ ] **T018** **[Release] Update `README.md`**
  - *Target File*: `README.md`
  - *Expected Behavior*: Add comprehensive documentation for the new CLI commands (`checkpoint`, `checkpoints`, `restore`), specifying parameters, safety features, and restore-as-unstaged behaviors.

- [ ] **T019** **[Release] Bump version in `package.json` and lockfile**
  - *Target Files*: `package.json`, `package-lock.json`
  - *Expected Behavior*: Bump version to `0.3.0`. Execute `npm install` to update lockfile.
  - *Validation*: Ensure version compiles correctly and is reflected in `package.json`.

- [ ] **T020** **[Release] Conduct documentation sanity check**
  - *Target Files*: Project specs and documentation
  - *Expected Behavior*: Confirm all updated documents strictly comply with Constitution Principles VII and VIII (Documentation and Release Prep).
