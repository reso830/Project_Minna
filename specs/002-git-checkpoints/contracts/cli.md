# CLI Command Surface Contract: Git Checkpoints

This contract defines the CLI interface for the **Git Checkpoints** feature. Minna exposes these commands through `src/cli.ts` (invoked via `node dist/cli.js` or `npm run dev`).

## 1. Commands Specification

### `minna checkpoint`

Creates a manual checkpoint of the current worktree.

* **Usage**: `minna checkpoint [--message <msg>]`
* **Flags**:
  - `--message <msg>`: (Optional) A custom message describing the checkpoint. Defaults to `"Manual checkpoint"` if omitted.
* **Output Format**:
  - On success, prints the generated reference to stdout:
    `Checkpoint created: refs/minna/checkpoints/manual/<id>/<seq>`
    Example:
    ```text
    Checkpoint created: refs/minna/checkpoints/manual/20260718-143052/1
    ```
* **Exit Codes**:
  - `0`: Success.
  - `1`: Failure (e.g. git error, missing git repository, or database event logging failure).

---

### `minna checkpoints`

Lists all checkpoint references in the repository, with optional filtering.

* **Usage**: `minna checkpoints [--context-type <type>] [--id <id>]`
* **Flags**:
  - `--context-type <type>`: (Optional) Limit results to the specified context type (e.g., `manual`, `pre-restore`).
  - `--id <id>`: (Optional) Limit results to the specified timestamp-based checkpoint ID.
* **Output Format**:
  - Prints one checkpoint per line, sorted chronologically.
  - Line format (plain text):
    `<ref> | [TIMESTAMP] | parent: <short-sha> | <message>`
    Example:
    ```text
    refs/minna/checkpoints/manual/20260718-143052/1 | 2026-07-18T14:30:52Z | parent: 2f10b7d6 | Manual checkpoint before refactoring
    refs/minna/checkpoints/pre-restore/20260718-143210/1 | 2026-07-18T14:32:10Z | parent: 2f10b7d6 | Safety checkpoint before restore
    ```
  - If no checkpoints are found, prints: `"No checkpoints found."`
* **Exit Codes**:
  - `0`: Success.
  - `1`: Failure (e.g. git command error, missing git repository).

---

### `minna restore`

Restores the repository's worktree to the state captured by the specified checkpoint.

* **Usage**: `minna restore <ref>`
* **Arguments**:
  - `<ref>`: (Required) The checkpoint reference or commit SHA to restore from. Can be specified in short format (e.g. `manual/20260718-143052/1` or full ref path).
* **Worktree State Handling**:
  - Checks if the worktree is dirty (contains uncommitted staged, unstaged, or untracked changes, including configured gitignored files).
  - If the worktree is **clean**: proceeds directly to restore.
  - If the worktree is **dirty**:
    1. Creates a safety checkpoint under the `pre-restore` namespace: `refs/minna/checkpoints/pre-restore/<id>/1`.
    2. Writes a `git.snapshot_created` event for this safety checkpoint.
    3. Prints the safety checkpoint details to stdout:
       `Saved uncommitted changes to refs/minna/checkpoints/pre-restore/<id>/1; recover with minna restore refs/minna/checkpoints/pre-restore/<id>/1`
    4. Proceeds to restore the target checkpoint.
* **Restore Process**:
  - Restores all files captured in the checkpoint into the active worktree as unstaged files.
  - Does not change the current branch HEAD or main index (non-invasive).
* **Output Format**:
  - On success, prints:
    `Worktree restored from <ref>`
* **Exit Codes**:
  - `0`: Success.
  - `1`: Failure (invalid ref, git error, or database event logging failure).
