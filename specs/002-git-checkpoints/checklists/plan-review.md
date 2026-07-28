# Pre-Implementation Review Checklist: Git Checkpoints

**Purpose**: Verification gate to check the plan and design artifacts against specifications, architecture soundness, and the Project Constitution before any implementation code is written.
**Created**: 2026-07-18
**Feature**: [spec.md](../spec.md)

**Gate result**: FAIL — open: CHK006, CHK015 (2026-07-19)

## 1. Specification & Scope Alignment

- [x] **CHK001**: The plan is strictly limited to the Git Checkpoints feature and does not implement agent running wrappers (003) or the work-item feature engine (M2).
- [x] **CHK002**: The plan includes `createCheckpoint`, `listCheckpoints`, and `restoreCheckpoint` core functions and exposes them through `minna checkpoint`, `minna checkpoints`, and `minna restore` CLI commands.
- [x] **CHK003**: The checkpoint namespacing scheme utilizes the context-type segment: `refs/minna/checkpoints/manual/` for manual checkpoints and `refs/minna/checkpoints/pre-restore/` for pre-restore safety checkpoints.

## 2. Architecture & Data Integrity

- [x] **CHK004**: Checkpoint creation is designed to be non-invasive, using a temporary git index file to avoid disturbing HEAD, the active branch ref, or the default repository index.
- [x] **CHK005**: All temporary git index files are cleaned up in a `finally` block to ensure no temp files are leaked on either success or failure (Constitution XIV).
- [ ] **CHK006**: Every checkpoint creation and restore operation is coupled with recording a corresponding event (`git.snapshot_created`, `git.snapshot_restored`) in the SQLite database journal (Constitution III).
- [x] **CHK007**: Single-tree restore is documented to restore files as unstaged in the worktree, which is acceptable and expected behavior since Minna owns git and agents do not stage (Constitution XIV, M0/B6).

## 3. Verification & Safety Enforcements

- [x] **CHK008**: Sequence generation resolves monotonic sequence numbers by querying and parsing existing refs under `refs/minna/checkpoints/<context-type>/<id>/`, avoiding brittle string-length checks.
- [x] **CHK009**: The ref update uses `git update-ref` with old target `0000000000000000000000000000000000000000` (create-only check) to prevent overwriting existing checkpoints under any circumstances (Constitution XIV).
- [x] **CHK010**: A restore command invoked on a dirty worktree automatically triggers a safety checkpoint in the `pre-restore` namespace first, making the restore operation completely reversible (Constitution XIV).
- [x] **CHK011**: Safety checkpoints created during restore are announced in the CLI output with the recovery reference and recorded as journal events, ensuring they are discoverable.

## 4. Contract Correctness & Error Behavior

- [x] **CHK012**: If the repository is not in a git working tree, checkpoint operations fail closed with a clear error.
- [x] **CHK013**: Ignored path force-adding is tolerant; missing paths are skipped without causing the checkpoint operation to crash (Constitution XIV).
- [x] **CHK014**: Restore writing/extraction logic is isolated/factorable to ensure a separate path restoration (`--to <path>`) can be easily implemented as a future capability.
- [ ] **CHK015**: Any failure during checkpointing or restoration fails closed, throwing a clear error rather than returning silent success/nulls.

## 5. Constitution & Cost Compliance

- [x] **CHK016**: No git checkout, branch switch, merge, rebase, push, or stash is performed by agents; git mutation operations are owned entirely by Minna (Constitution XIII).
- [x] **CHK017**: No state-mutating authority is granted to agents, and the checkpoint commands are fully deterministic and inspectable (Constitution II, XIII).
- [x] **CHK018**: No third-party git libraries (e.g. `isomorphic-git`, `nodegit`) are added without justification; the implementation executes standard git binaries as child processes (Constitution XII).
- [x] **CHK019**: No paid APIs, cloud infrastructure, or hosted databases are required; all operations are local and offline-first (Constitution VI, XVI).
