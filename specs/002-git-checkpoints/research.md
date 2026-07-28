# Research: Git Checkpoints

This document resolves the key technical decisions for the **Git Checkpoints** feature, aligning with the Feature Brief, Specification, and the Project Constitution.

## 1. Refs Namespacing Scheme

* **Decision**: Checkpoint refs are namespaced by context-type as the first path segment after `refs/minna/checkpoints/`.
  - Manual checkpoints (context-free) use `manual/`:
    `refs/minna/checkpoints/manual/<id>/<seq>`
  - Safety checkpoints created before a restore use `pre-restore/`:
    `refs/minna/checkpoints/pre-restore/<id>/<seq>`
  - `<id>` is a timestamp-based folder (e.g., `20260718-143052`).
  - `<seq>` is a monotonic sequence number starting at `1` for each `<id>`.
* **Rationale**: 
  - Prevents a global sequence counter from turning the repository into an untraceable "junk drawer" (no way to tell the purpose of a checkpoint).
  - Ensures sequence numbers are easy to resolve monotonically within their specific context-type and ID.
  - Allows easy future extension to `run/<runId>/` (feature 003) and `feature/<featureId>/` (M2) without structural redesign.
* **Alternatives Considered**:
  - A single default bucket (`refs/minna/checkpoints/default/<seq>`): Rejected because it accumulates unrelated checkpoints with no metadata trace.
  - Requiring a feature context for all checkpoints: Rejected because feature context (M2 work items) does not exist in M1, which would make checkpoints unusable in the M1 scenarios they are built for.

## 2. Restore Safety and Reversibility

* **Decision**: Before restore modifies the worktree, checkpoint the current dirty state to `refs/minna/checkpoints/pre-restore/<id>/<seq>`. Announce the saved ref in the CLI output, and record it as a journal event (`git.snapshot_created`).
* **Rationale**:
  - Prevents the founding incident of losing uncommitted edits when performing git operations (Article XIV).
  - Makes restore itself recoverable-by-construction.
  - Outputting the ref name explicitly guarantees the user knows how to recover their previous work.
* **Alternatives Considered**:
  - Refuse to restore on a dirty worktree: Rejected because the primary use case of `restore` is recovering from a messy state, and refusing would force the operator to clean up manually.
  - Discard/Force restore: Rejected. Directly violates Constitution Article XIV.

## 3. Restore Target Destination

* **Decision**: Restore files directly into the active worktree (content unstaged).
* **Rationale**:
  - Follows Constitution Article XIV and M0/B6: a single-tree restore returns content unstaged, which is acceptable since Minna owns git and agents never stage.
  - To prevent blocking future capabilities, the restore logic (commit extraction and file writing) will be factorable so a `--to <path>` target-path variant can easily reuse it.
* **Alternatives Considered**:
  - Restoring into a separate temporary directory by default: Rejected because the core purpose of restore is recovering the active workspace. Separate extraction is a distinct future capability.

## 4. Checkpoint Pruning and Garbage Collection

* **Decision**: Fully deferred from 002.
* **Rationale**:
  - Checkpoints are cheap dangling commits that do not create scale pressure or disk issues in v1.
  - Pruning/GC deletes checkpoints, which stands in tension with Article XIV's recoverable-by-construction guarantee. Deleting safety nets requires deliberate design (e.g. keeping `pre-restore/` files safe), which should be handled as its own dedicated feature.
* **Alternatives Considered**:
  - Simple "keep last N" policy: Rejected as it might delete critical safety checkpoints before they are reviewed.

## 5. Metadata Storage Approach

* **Decision**: Store metadata in the git commit object itself to ensure it is self-describing, utilizing git native fields (parent for base commit, commit date for timestamp) and standard Git Trailers in the commit message body for Minna-specific attributes (context-type, context-id, sequence, and reason).
* **Rationale**:
  - Resolving metadata directly from the commit object ensures there is no second source of truth that can desync from the checkpoint commit (avoiding the two-ledgers anti-pattern rejected by Article III and VI).
  - Git parent commits and commit dates are already tracked natively by git. Duplicating them in the message body is redundant and risks conflicting values.
  - Minna-specific metadata is stored as standard Git Trailers (e.g. `Minna-Context-Type: <type>`, `Minna-Context-Id: <id>`, `Minna-Sequence: <seq>`, `Minna-Reason: <msg>`), which are easily queryable and greppable using `git log --format="%(trailers)"` and remain attached to the commit object.
* **Alternatives Considered**:
  - Sidecar files: Rejected because external files are detachable and easily desynchronized from the actual git references.
  - Git notes: Rejected due to extra overhead and complexity in managing and pushing/pulling notes references.

## 6. Ignored Path Configuration

* **Decision**: Read `checkpoint.includeIgnored` from project configuration (`minna.project.yaml` -> `project.checkpoint.includeIgnored`), falling back to a minimal, conservative default list (or empty list) if the file is unconfigured or missing.
  - **Tolerant Force-Add**: Force-add each path individually and skip if absent on disk.
* **Rationale**:
  - Config over hardcoding is chosen because the set of gitignored agent-scratch paths is project-specific and evolves as new agents and projects (Monica, Eila, etc.) are introduced. This needs to be operator-editable data rather than a code change + release.
  - Doing individual force-adds is required to prevent failures. A single path that doesn't exist on disk will cause `git add -Af <missing>` to exit 128 (fatal). Skipping missing paths prevents the safety net from failing due to empty folders.
  - Minimizing default lists avoids over-capturing large or sensitive untracked paths.
* **Alternatives Considered**:
  - Hardcoding a single list: Rejected as it blocks customization for external projects.
  - Command-line arguments only: Rejected because configuring ignored paths on every CLI invocation is highly error-prone.
