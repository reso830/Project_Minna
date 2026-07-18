# CLI Command Surface Contract

This contract defines the CLI interface for the **Event Journal** feature. Minna exposes these commands through `src/cli.ts` (invoked via `node dist/cli.js` or `npm run dev`).

## 1. Commands Specification

### `minna log`

Displays a chronological list of events recorded in the database.

* **Usage**: `minna log [--feature <id>]`
* **Flags**:
  - `--feature <id>`: (Optional) Limits log events to the specified feature ID.
* **Output Format**:
  - Prints events in ascending chronological order (one per line).
  - Line format (plain text):
    `[ISO-8601 UTC TIMESTAMP] [ACTOR] [TYPE] - <JSON payload>`
    Example:
    ```text
    [2026-07-16T21:26:08.000Z] [human] [feature.created] - {"id":"project-minna-event-journal-1721165168","title":"Event Journal","status":"initial"}
    [2026-07-16T21:30:15.000Z] [system] [feature.status_updated] - {"id":"project-minna-event-journal-1721165168","status":"plan"}
    ```
* **Exit Codes**:
  - `0`: Success.
  - `1`: Error (e.g., database file is corrupt/inaccessible, or `--feature <id>` is provided but no creation event exists for `<id>`).
* **Error Messages**:
  - If no events exist in the database and no `--feature` is passed: prints `"No events found in journal."` and exits `0`.
  - If `--feature <id>` is specified but feature `<id>` does not exist: prints `"Error: No such feature '<id>'"` and exits `1`.

---

### `minna verify`

Validates that the current-state projection (`features` table) matches the event log and checks for schema/invariant violations.

* **Usage**: `minna verify`
* **Flags**: None.
* **Output Format**:
  - If consistent: prints `"Verification successful: No drift detected (N features, M events)."`
  - If inconsistent (drift detected): prints detailed discrepancy reports to stderr, naming the feature ID and the specific fields that mismatch.
    Example of structural drift:
    ```text
    Verification failed: Drift detected in feature 'project-minna-event-journal-1721165168'
      Field 'status': database has 'implement', replay derived 'plan'
    ```
    Example of invariant violation:
    ```text
    Verification failed: Invariant violation
      Feature 'orphaned-feature-id' exists in features projection table but has no corresponding 'feature.created' event in the journal.
    ```
* **Exit Codes**:
  - `0`: Consistent (no drift).
  - `1`: Inconsistency/drift detected, or database error.

---

### `minna export`

Exports the event timeline of a specific feature as a Markdown document.

* **Usage**: `minna export --feature <id> <dir>`
* **Arguments**:
  - `<dir>`: (Required) Target directory where the Markdown file will be written. Created if it does not exist.
* **Flags**:
  - `--feature <id>`: (Required) The ID of the feature to export.
* **Output File**:
  - Writes to `<dir>/journal.md`.
  - File format: UTF-8 plain-text Markdown.
  - Template structure of `<dir>/journal.md`:
    ```markdown
    # Event Journal: <Feature Title>
    
    * **Feature ID**: `<id>`
    
    | Timestamp (UTC) | Actor | Event Type | Description / Detail |
    |---|---|---|---|
    | 2026-07-16 21:26:08 | human | `feature.created` | Created feature: <Title> |
    | 2026-07-16 21:30:15 | system | `feature.status_updated` | Updated status to: `plan` |
    ```
* **Exit Codes**:
  - `0`: Success.
  - `1`: Error (missing required parameters, feature `<id>` not found, or directory path not writable).
