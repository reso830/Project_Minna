# Research: Project Registry (001)

## Current State Analysis

### 1. Project Resolution (`src/core/project-context.ts`)
The project already contains a `resolveProjectContext` function that handles:
- **Central Mode:** Reading from `projects.yaml`.
- **Embedded Mode:** Reading from `minna.project.yaml` in the CWD.
- **Path Normalization:** Correctly resolving relative paths based on the configuration file's location.

**Gap:**
- It does not support session persistence (Option B).
- It does not handle the `status` field.
- Validation is minimal (only existence of the project key).

### 2. State Management (`src/core/state.ts`)
- Currently manages `features.json`.
- Uses simple file-backed storage in a `state/` directory.

### 3. CLI Interface (`src/cli.ts`)
- Basic argument parsing via `process.argv`.
- Supports `status` and `start-feature` commands.

## Implementation Strategy

### 1. Persistence Layer
We need a new state file `state/session.json` to store the `activeProjectKey`. This will allow operators in Central Mode to "lock" onto a project.

### 2. Status Lifecycle
Update `ProjectConfig` in `src/core/types.ts` and `src/core/config.ts` to include the `status` field. Default to `active` if missing.

### 3. Metadata Validation
Implement a robust validation helper that checks:
- Required fields: `name`, `path`, `speckit_dir`.
- Uniqueness of keys in `projects.yaml`.
- Valid path format (resolvable string).

### 4. New CLI Commands
- `minna projects`: List all projects from `projects.yaml`.
- `minna select <key>`: Persist a project key to session state.

## Risks & Tradeoffs
- **Mode Conflict:** If an operator selects project A in session state but runs the CLI from within project B (Embedded), the Embedded mode should win for zero-config local operation.
- **State Corruption:** Manual edits to `session.json` or `projects.yaml` could break the orchestrator. Defensive parsing is required.
