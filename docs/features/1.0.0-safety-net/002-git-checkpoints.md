# 002-git-checkpoints

> Feature brief — input to `/specify`. Open questions are left for the clarify gate.

## Feature Overview

Git checkpoints capture the complete state of a worktree as a recoverable object
**before and after every agent run** and before any destructive operation, so that no
agent work can be lost by a subsequent branch switch, checkout, discard, or crash.

This is the feature that would have prevented the founding incident: ~1 hour of an
agent's uncommitted worktree edits destroyed when an external tool switched the active
branch. It is the reason M1 exists.

## Why this exists

Agents produce uncommitted work, and external tools (or the operator) can destroy it
with a single branch operation. Minna's answer is to snapshot everything recoverable,
non-invasively, as a dangling commit the agents never see, keyed to the run — so a
destroyed worktree is always restorable.

## Goals

* Snapshot full worktree state (committed, staged, unstaged, untracked, and configured
  gitignored paths) as a recoverable git object.
* Do so without disturbing HEAD, the branch, the working tree, or the index.
* Make checkpoints addressable, monotonic, and impossible to accidentally overwrite.
* Provide list and restore operations, and record every checkpoint as a journal event.

## Constitutional constraints (must hold — Const. XIV)

* **Before and after every agent run**, and before any destructive op.
* **Capture everything an agent may produce**: staged, unstaged, untracked, AND every
  path in `checkpoint.includeIgnored` (agent work ledgers live in gitignored dirs).
  Force-adding a configured path that does not exist must be **tolerated, not fatal**
  (M0: `git add -Af <missing>` exits 128).
* **Non-invasive**: a dangling commit; branch/HEAD/index/worktree untouched; agents
  never see checkpoint commits (Const. XIV, XIII).
* **Monotonic, create-only refs**: correct sequence computation AND a create-only
  atomic ref update so a bad sequence can never overwrite an existing checkpoint.
* **Documented restore semantics**: single-tree restore returns content unstaged; this
  is acceptable (Minna owns git, agents never stage) but must be stated, not discovered.
* **Fail loudly**: checkpoint failure surfaces as an error; never a silent null the
  caller mistakes for success (Const. I fail-closed).
* **Clean up**: temporary index files removed on success and failure.

Every operation writes a journal event (001), e.g. `git.snapshot_created`.

## In scope

* `createCheckpoint(featureId, message)` core: temp index → `read-tree HEAD` →
  `add -A` → force-add each existing `includeIgnored` path → `write-tree` →
  `commit-tree -p HEAD` → create-only `update-ref refs/minna/checkpoints/<feature>/<seq>`.
* Correct monotonic sequence derivation (M0/B2: not string length; count/parse refs).
* Tolerant force-add of configured ignored paths (skip missing).
* `minna checkpoint`, `minna checkpoints` (list), `minna restore <ref>`.
* Temp-index cleanup in a `finally`.
* Journal events for create/restore.

## Non-goals

* Running agents (003) — this feature is exercised manually / by tests in M1.
* Scope-escape detection (that lands with the run wrapper, 003) — though the
  before/after snapshot primitive may be shared.
* Multi-parent / stash-style index preservation (M0/B6: explicitly rejected — Minna
  owns git, agents never stage, so index state is not worth preserving; document
  restore-as-unstaged instead).
* Checkpoint pruning/GC policy (defer; note as a follow-up).
* Worktree *creation/management* per feature (belongs with the work-item engine, M2).

## Behavior (CLI, indicative — refine in spec)

* `minna checkpoint [--message <m>]` → create a checkpoint of the current worktree.
* `minna checkpoints [--feature <id>]` → list checkpoint refs with metadata.
* `minna restore <ref>` → restore the worktree from a checkpoint (content unstaged).

## Open questions for the clarify gate

* Namespace/key scheme for refs when there is not yet a feature context (M1 has no
  work-item engine): a default namespace? a per-invocation id?
* Restore safety: does `restore` refuse on a dirty worktree, or checkpoint-then-restore?
  (Fail-closed suggests the latter, but confirm.)
* Does `restore` restore *into the current worktree*, or is checkout-to-a-path in scope?
* Pruning: fully deferred, or a minimal "keep last N" now?
* Exact metadata stored per checkpoint (base commit, timestamp, reason, run linkage
  once 003 exists).

## Independent tests (CLI / git-state assertions)

* Checkpoint a worktree with staged + unstaged + untracked + a configured ignored file;
  `restore` reproduces all of it (content present; unstaged is acceptable).
* `git rev-parse HEAD` and `git status` are unchanged after checkpointing (non-invasive).
* Two checkpoints in a row produce two distinct refs; neither is lost; sequence is
  monotonic.
* A configured `includeIgnored` path that does not exist does NOT crash checkpointing.
* A forced failure surfaces as an error (no silent null); no temp files remain in
  `os.tmpdir()` afterward.
* Each operation appears as a journal event.

## Dependencies

* 001-event-journal (records checkpoint events).