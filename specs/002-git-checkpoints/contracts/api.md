# Git Checkpoints Library API Contract

This contract defines the library interface (TypeScript API) for interacting with the **Git Checkpoints** service. These methods reside in `src/core/checkpoints.ts` (or `src/core/git.ts` as appropriate) and are consumed by the CLI and other system services.

## 1. Type Definitions

```typescript
import type { DatabaseSync } from "node:sqlite";

export type CheckpointContextType = "manual" | "pre-restore" | "run" | "feature";

export interface CheckpointMetadata {
  ref: string;                // Full git ref: refs/minna/checkpoints/<contextType>/<id>/<seq>
  contextType: CheckpointContextType;
  id: string;                 // Timestamp group ID (e.g., "20260718-143052")
  seq: number;                // Sequence number within the group
  commitHash: string;         // SHA-1 hash of the checkpoint commit
  parentHash: string;         // SHA-1 hash of the HEAD commit at checkpoint time
  message: string;            // Commit message / description
  timestamp: string;          // ISO 8601 string in UTC format
}

export interface CreateCheckpointOptions {
  contextType: CheckpointContextType;
  message?: string;           // Optional reason/message for checkpoint
  id?: string;                // Optional custom timestamp ID (defaults to current date-time)
}
```

---

## 2. API Methods

### `createCheckpoint(db: DatabaseSync, options: CreateCheckpointOptions): Promise<CheckpointMetadata>`

Captures the complete state of the worktree as a recoverable dangling git commit and records it in the event journal.

* **db**: The SQLite database connection to write the journal event.
* **options.contextType**: The type of checkpoint context (e.g. `"manual"`, `"pre-restore"`).
* **options.message**: The checkpoint description. Defaults to `"Manual checkpoint"` or `"Safety checkpoint"`.
* **options.id**: The ID of the group. If omitted, generated as `YYYYMMDD-HHMMSS`.
* **Behavior**:
  - Validates git is available and a repository exists.
  - Query git references under `refs/minna/checkpoints/<contextType>/<id>/` to compute the next sequential sequence number `<seq>` (starting at `1`).
  - Sets up a temporary git index file `.git/index-minna-checkpoint-<random>`.
  - In a `try-catch-finally` block:
    1. Read HEAD into the temporary index: `git read-tree HEAD`.
    2. Add all files in the worktree: `git add -A`.
    3. Read path configurations for `checkpoint.includeIgnored` from the project config (e.g. `minna.project.yaml` under `project.checkpoint.includeIgnored`). For each path that exists, force-add it: `git add -f <path>`. If the path does not exist, tolerate and skip it without crashing (Article XIV).
    4. Write the index to a tree: `git write-tree`.
    5. Create a commit from the tree: `git commit-tree <treeHash> -p HEAD -m <message>`. The base commit (parent SHA) and timestamp are resolved natively from the commit object's parent and date. Minna-specific metadata is appended to the commit message body as Git Trailers (`Minna-Context-Type`, `Minna-Context-Id`, `Minna-Sequence`, and `Minna-Reason`).
    6. Log the `git.snapshot_created` event to the SQLite database journal (committed immediately to ensure durability).
    7. Run `git update-ref refs/minna/checkpoints/<contextType>/<id>/<seq> <commitHash> 0000000000000000000000000000000000000000`.
    8. If the reference update fails (e.g. sequence collision), append a compensating `git.snapshot_create_failed` event to the journal database (Article III — never delete committed events) and propagate the error.
    9. Returns the `CheckpointMetadata`.
  - In the `finally` block, deletes the temporary git index file.
* **Exceptions**:
  - Throws an error if git commands fail, if a sequence collision is detected (create-only ref write fails), or if the database event logging / transaction fails.

---

### `listCheckpoints(options?: { contextType?: CheckpointContextType; id?: string }): Promise<CheckpointMetadata[]>`

Retrieves all checkpoint references and parses their metadata.

* **options.contextType**: (Optional) Filter by context type.
* **options.id**: (Optional) Filter by checkpoint ID.
* **Returns**: Array of `CheckpointMetadata` sorted chronologically.
* **Behavior**:
  - Queries git refs under `refs/minna/checkpoints/` (using `git for-each-ref`).
  - For each matching ref, retrieves the commit hash and parses the commit details (resolving parent as base commit, author/committer date as timestamp, and Minna-specific attributes from the Git Trailers in the commit message body).

---

### `restoreCheckpoint(db: DatabaseSync, ref: string): Promise<void>`

Restores the repository's worktree to the state captured in the specified ref.

* **db**: The SQLite database connection to write the journal event.
* **ref**: The checkpoint ref or commit SHA. If a short-format ref is passed (e.g. `manual/20260718-143052/1`), resolves it to the full ref.
* **Behavior**:
  - Validates that the target ref exists in git.
  - Checks if the worktree is dirty: runs `git status --porcelain --ignored`, and checks if any staged, unstaged, untracked, or modified includeIgnored paths are present.
  - If **dirty**:
    1. Triggers `createCheckpoint(db, { contextType: "pre-restore", message: "Safety checkpoint before restoring " + ref })`.
    2. Announces the safety checkpoint to stdout.
  - Performs the restore of the worktree (Index-Isolated Restore):
    1. Defines a temporary index path `.git/index-minna-restore-<random>`.
    2. Inside a try-catch-finally block:
       - Run `git read-tree --index-output=<temp-index> <target-ref>` (reads target commit's tree into temp index).
       - Run `git checkout-index -a -f -u` setting the environment variable `GIT_INDEX_FILE` to the temporary index file path (checks out all files from temp index, overwriting changed files unstaged; HEAD and main index remain undisturbed).
       - Compute deletion set using git's file lists (never a filesystem walk):
         - **Candidate files**: tracked + untracked files (`git ls-files --cached --others --exclude-standard`) plus configured `includeIgnored` files existing on disk. Explicitly exclude `.git/` and any unconfigured ignored files.
         - **Checkpoint files**: `git ls-files` run with environment variable `GIT_INDEX_FILE` set to the temporary index.
         - **Deletion action**: Delete candidate files that are not present in the checkpoint files.
    3. In the `finally` block, deletes the temporary git index file.
   - Logs `git.snapshot_restored` to the database journal. If this SQLite write fails, it is treated as non-fatal/best-effort: it prints a warning to stderr but does not throw an error or abort the successful restore.
* **Exceptions**:
  - Throws if the ref does not exist or if file write/restore operations fail. (Database event logging failures on restore are non-fatal).
