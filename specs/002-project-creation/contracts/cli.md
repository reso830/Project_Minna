# CLI Contract: Project Creation

This document outlines the behavior and interface contract for CLI-driven synchronization with the global project database registry (`~/.minna/projects.db`) for Feature 002 - Project Creation.

## CLI Invocation & Context Resolution

Whenever a developer runs a Minna CLI command (e.g. `npm run cli status`, `npm run cli start-feature`), the CLI resolves the current project context:

1. **Embedded Mode**: The CLI inspects the current working directory (cwd) and traverses upwards through its parent directory chain for the presence of:
   - A `.minna/config.yaml` file (new convention).
   - A legacy `minna.project.yaml` file. If found, the CLI migrates/renames it to `.minna/config.yaml` to comply with the new directory configuration convention.
2. **Explicit Project Flag Mode**: The developer specifies `--project <key>` during command invocation.

### Context Resolution Rules
- The CLI **replaces** legacy central resolution targeting `projects.yaml` (which is deleted).
- **Verbatim Project Flag Integration (Shipped Preserved)**: To align with existing shipped code, specifying `--project <key>` treats the key as a free-text label for project scoping without validation blockages. The CLI does NOT validate that the key exists in `~/.minna/projects.db` and never throws an `Unknown project: <key>` error if it is absent.
- If the directory path resolved by embedded mode no longer exists on disk, the CLI fails closed with `Project directory not found: <path>`.

---

## Registry Synchronization Contract

Once the project context is successfully resolved, the CLI performs synchronization with the global registry database:

1. **Transaction Lock**: Acquire a database write lock using `BEGIN IMMEDIATE TRANSACTION` on `~/.minna/projects.db`.
2. **Upsert Operation**:
   - Check if an entry with the resolved `path` already exists in the `projects` table.
   - **Case A (Exists)**: Update the entry's `last_opened_at` field to the current ISO 8601 UTC timestamp.
   - **Case B (New Path)**: 
     - Generate a slugified lowercase `id` from the directory name.
     - Handle collisions by appending sequential numeric suffixes (e.g. `slug-2`) if the `id` already exists for a different path.
     - Insert a new row with `id`, preserved folder-casing `name`, absolute `path`, and current `last_opened_at` timestamp.
3. **Event Recording**: Append a `project.opened` (for Case A) or `project.registered` (for Case B) event to the global database `events` table in the same transaction.
4. **Commit & Export**: Commit the transaction and write a read-only JSON copy to `~/.minna/projects.json`.
