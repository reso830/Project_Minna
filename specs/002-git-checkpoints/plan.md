# Implementation Plan: Git Checkpoints

**Branch**: `002-git-checkpoints` | **Date**: 2026-07-18 | **Spec**: [spec.md](file:///D:/Alvin/_CodeProjects/Project_Minna/specs/002-git-checkpoints/spec.md)
**Input**: Feature specification from `/specs/002-git-checkpoints/spec.md`

## Summary

Git Checkpoints capture the complete state of a repository's working directory (staged, unstaged, untracked, and configured gitignored paths) as a dangling git commit without altering HEAD, the active branch reference, or the primary git index file. Checkpoints are indexed with create-only, monotonic sequence references under `refs/minna/checkpoints/<context-type>/<id>/<seq>` where `<context-type>` is `manual` or `pre-restore` in this phase.
We will implement core library functions (`createCheckpoint`, `listCheckpoints`, `restoreCheckpoint`) that orchestrate git commands via a temporary index file. The restore process on a dirty worktree will automatically snapshot the dirty state into a `pre-restore` checkpoint first. Every creation and restore operation will write a paired event (`git.snapshot_created`, `git.snapshot_restored`) to the SQLite database journal. CLI commands (`checkpoint`, `checkpoints`, `restore`) will expose these capabilities.

---

## Technical Context

* **Language/Version**: Node.js (TypeScript, ES Modules, Node.js >= 22)
* **Primary Dependencies**: Native `node:child_process` for Git subprocesses, `node:sqlite` for database events (zero external dependencies)
* **Storage**: Git Object Database & Reference Store, SQLite Event Journal (`.minna/minna.db`)
* **Testing**: Node.js built-in test runner (`node --test`) & assertion library (`node:assert/strict`)
* **Target Platform**: Local execution with a host Git client
* **Constraints**: Offline-first, local-only, single-operator execution, non-invasive workspace changes, requires at least one existing commit in the repository (unborn HEAD is unsupported)
* **Performance Goals**: Checkpoint creation and restoration completing in <500ms

---

## Constitution Check & Compliance

This feature complies with and enforces the rules in the Project Constitution:

* **Article XIII (Minna Owns Git; Subprocess Boundary)**: Checkpoint operations are executed by Minna's CLI and core library using Node child processes to execute git command-line binaries. External agents remain sandboxed, have no tools to interact with Git or switch branches, and cannot mutate workflow state.
* **Article XIV (Git Safety Is Recoverable By Construction)**: 
  - We capture all staged, unstaged, untracked, and configured gitignored paths (e.g. `.agents/`, `.specify/`).
  - Missing ignored paths are skipped tolerantly without crashing (Constitution requirement).
  - Monotonic refs use `git update-ref` with an old SHA constraint of `0000000000000000000000000000000000000000` to prevent overwriting existing refs.
  - Restore on a dirty worktree automatically captures a safety checkpoint under `pre-restore/` and outputs details to the operator to prevent uncommitted work loss.
  - Single-tree restore returns content unstaged (documented restore semantics).
  - Temporary index files are always cleaned up in a `finally` block on both success and failure.
* **Article III (State Is The Source Of Truth)**: Checkpoint creations and restorations record corresponding events in the database journal.
* **Article XII (Simplicity Before Scale)**: No new npm packages or complex wrappers (such as isomorphic-git) are introduced. Git child processes are executed directly.

---

## Architecture & Data Flow

### Checkpoint Creation Flow

```text
[CLI: minna checkpoint]
           ↓
[src/core/checkpoints.ts: createCheckpoint]
           ↓
 1. Generate timestamp-based ID: YYYYMMDD-HHMMSS (if not provided)
 2. Parse existing refs to determine next monotonic sequence <seq>
 3. Define temporary index path: .git/index-minna-checkpoint-<random>
 4. Try:
    a. git read-tree HEAD (reads current commit index into temporary index)
    b. git add -A (stages all staged, unstaged, untracked files into temp index)
    c. Resolve project config for ignored paths. For each path that exists,
       run git add -f <path> (tolerate/skip missing paths)
    d. git write-tree -> returns <tree-sha>
    e. git commit-tree <tree-sha> -p HEAD -m <message> (attaching context-type, context-id, sequence, and reason as Git Trailers) -> returns <commit-sha>
    f. Write and commit the 'git.snapshot_created' event to the SQLite database journal (committed first to ensure durability).
    g. Run `git update-ref refs/minna/checkpoints/<context-type>/<id>/<seq> <commit-sha> 0000000000000000000000000000000000000000` (aborts if ref already exists).
    h. If the git ref update fails (e.g. sequence collision), append a compensating `git.snapshot_create_failed` event to the SQLite database journal and propagate the error. Do **never** delete the committed `git.snapshot_created` event row (Article III).
 5. Finally:
    a. Delete temporary index file
```

### Restore Flow

```text
[CLI: minna restore <ref>]
           ↓
[src/core/checkpoints.ts: restoreCheckpoint]
           ↓
 1. Check worktree dirty status: run git status --porcelain --ignored, and scan if any staged, unstaged, untracked, or modified includeIgnored paths exist.
 2. If dirty:
    a. Run createCheckpoint for 'pre-restore' safety checkpoint
    b. Print safety checkpoint reference and recovery instruction to stdout
    c. Record 'git.snapshot_created' event in SQLite journal
 3. Restore files from target checkpoint commit to active worktree (Index-Isolated Restore):
    a. Define temporary index path: .git/index-minna-restore-<random>
    b. Try:
       - Run `git read-tree --index-output=<temp-index> <target-ref>` (reads target commit's tree into temp index)
       - Run `git checkout-index -a -f -u` with environment variable `GIT_INDEX_FILE` set to `<temp-index>` (checks out all files from temp index, overwriting changed files unstaged; HEAD and main index remain undisturbed)
       - Compute the deletion set using git's file lists (never a filesystem walk) to delete files absent from the target checkpoint:
         - **Candidate files**: tracked + untracked files (`git ls-files --cached --others --exclude-standard`) plus configured `includeIgnored` files existing on disk. Explicitly exclude `.git/` and any unconfigured ignored files (so they are never deleted).
         - **Checkpoint files**: `git ls-files` run with environment variable `GIT_INDEX_FILE` set to `<temp-index>`.
         - **Deletion action**: Delete candidate files that do not appear in the checkpoint files.
    c. Finally:
       - Delete temporary index file
 4. Record 'git.snapshot_restored' in SQLite event journal (best-effort/non-fatal: if the database write fails, the CLI prints a warning `"Error: restore succeeded; audit event failed to record"` to stderr and exits `0` (success) rather than throwing an error as if the restore itself failed).
 5. Print success message to stdout
```

---

## Project Structure

### Documentation (this feature)

```text
specs/002-git-checkpoints/
├── plan.md              # This implementation plan
├── spec.md              # Feature specification
├── research.md          # Design decisions and alternatives considered
├── data-model.md        # Git refs structure and event payload definitions
├── quickstart.md        # Developer quickstart and command reference
├── contracts/           # API and CLI command surface contracts
│   ├── api.md
│   └── cli.md
└── checklists/
    └── plan-review.md   # Pre-implementation checklist
```

### Source Code

```text
src/
├── core/
│   ├── checkpoints.ts   # [NEW] Checkpoint creation, listing, restoration logic and temporary index helpers
│   ├── db.ts           # [MODIFIED] Registered event types mapping for validation
│   └── types.ts        # [MODIFIED] Added checkpoint types and updated EventEnvelope constraints
├── cli.ts              # [MODIFIED] Added checkpoint, checkpoints, and restore CLI commands
```

**Structure Decision**: Core git operations and metadata parsing are housed in `src/core/checkpoints.ts`, with integration exposed through the entry point `src/cli.ts`.

---

## Affected Areas

### Files/Components likely to be Inspected
* `src/cli.ts` (CLI command router)
* `src/core/db.ts` (for database event schema and validation rules)
* `src/core/types.ts` (defining event types)

### Files/Components likely to be Modified
* `src/cli.ts` (Add `checkpoint`, `checkpoints`, `restore` commands and update help)
* `src/core/types.ts` (Add `GitSnapshotCreatedPayload` and `GitSnapshotRestoredPayload` types)
* `src/core/db.ts` (Accept `git.snapshot_created` and `git.snapshot_restored` as valid event type strings in verification/replay logic)

### Tests likely to be Added or Updated
* `src/core/checkpoints.test.ts` (New file: Unit/integration tests verifying checkpoint creation, non-invasiveness, monotonicity, pre-restore safety, ignore path configuration toleration, temp index cleanup, and journal logging)

### Areas Explicitly Out of Scope
* State workflow phase engine (`src/core/workflow.ts`)
* Agent execution run wrapper (Feature 003)
* Findings, reviews, and human approvals (M2)

---

## Risks and Tradeoffs

* **Risk**: Conflict with system-level Git locks or other concurrent Git processes.
  - *Tradeoff/Mitigation*: We execute checkpoints using isolated temporary index files (`GIT_INDEX_FILE`). This bypasses the main index file lock and ensures we do not block or get blocked by normal user git commits or status checks.
* **Risk**: Large repositories or massive untracked folders may take time to snapshot.
  - *Tradeoff/Mitigation*: Using Git's native tree-writing commands is highly optimized. We only force-add paths specifically defined in the project config under `checkpoint.includeIgnored` (which are small, e.g. agent logs), rather than indexing the entire `.gitignored` folders like `node_modules`.

---

## Validation Approach

1. **Unit and Integration Tests (Run in Isolated Git Fixture Repositories)**:
   - All checkpoint and restore tests must execute against dynamically initialized temporary git repositories (initialized in a scratch directory, e.g. via `fs.mkdtemp`). The host Project Minna repository must never have test references or test commit objects written to it.
   - Verify checkpoint captures staged, unstaged, untracked, and ignored files correctly.
   - Verify `git rev-parse HEAD` and `git status` are identical before and after checkpointing (non-invasiveness).
   - Assert sequence number monotonicity: multiple sequential checkpoints increments the sequence number correctly.
   - Assert create-only check: verify that trying to write a ref that already exists throws an error and doesn't overwrite it.
   - Test ignore path toleration: verify that a configured path that doesn't exist does not crash the checkpoint process.
   - Test pre-restore safety: verify that restoring onto a dirty worktree captures a safety checkpoint under the `pre-restore/` namespace first.
   - Verify temp index files are deleted from the disk on both success and failure.
   - Assert database events are correctly logged to the SQLite database.
2. **CLI Validation**:
   - Compile code and run `npm run dev checkpoint`. Assert the ref is printed and exists in the git store.
   - Run `npm run dev checkpoints` and verify formatting of the list.
   - Make uncommitted edits, run `npm run dev restore <ref>`, and assert that the uncommitted edits are saved to a `pre-restore/` ref and the worktree is restored.
   - Verify the journal events are written using `npm run dev log`.

---

## Complexity Tracking

No constitutional violations exist. Simple native Node features and raw DDL/DML statements are leveraged.
No new dependencies are introduced.
