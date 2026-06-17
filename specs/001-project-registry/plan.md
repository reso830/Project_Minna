# Implementation Plan: Project Registry

**Branch**: `001-project-registry` | **Date**: 2026-06-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification for Project Registry (001)

## Summary
Implement a robust project registration and discovery system for Minna. This includes expanding the existing `ProjectContext` logic to support session-based selection persistence, rich project status tracking, and a new suite of CLI commands for project management.

## Technical Context

**Language/Version**: TypeScript 5.7 (Node.js >= 22.0.0)
**Primary Dependencies**: `yaml` (YAML parsing)
**Storage**: File-backed (`projects.yaml`, `minna.project.yaml`, `state/session.json`)
**Testing**: Node.js test runner (`node --test`)
**Project Type**: CLI Orchestrator

## Constitution Check

- **I. Human Authority:** CLI commands only provide information; humans edit YAML or run `select`.
- **II. Deterministic Orchestration:** Selection is stored in a visible `session.json` file.
- **V. Local-First Simplicity:** State is file-backed and human-readable.
- **X. Workflow Smoke Testing:** Unit tests for path resolution and validation are mandatory.

## Project Structure

### Documentation (this feature)

```text
specs/001-project-registry/
├── plan.md              # This file
├── research.md          # Technical research and gap analysis
└── spec.md              # Feature specification
```

### Source Code

```text
src/
├── cli.ts               # ADD 'projects', 'select' commands
├── core/
│   ├── config.ts        # UPDATE schema for 'status'
│   ├── project-context.ts # UPDATE for session persistence & resolution priority
│   ├── session.ts       # NEW: handles state/session.json
│   ├── types.ts         # UPDATE 'ProjectConfig', 'ProjectContext'
│   └── validation.ts    # NEW: project metadata validation
```

## Affected Areas

### Files to Inspect
- `src/cli.ts`: Current command routing.
- `src/core/project-context.ts`: Existing resolution logic.
- `src/core/config.ts`: Existing YAML loading.

### Files to Modify
- `src/core/types.ts`: Add `ProjectStatus` enum and update `ProjectConfig`.
- `src/core/project-context.ts`: Integrate session resolution and status filtering.
- `src/cli.ts`: Add new command handlers.

### Files to Create
- `src/core/session.ts`: Logic for reading/writing `state/session.json`.
- `src/core/validation.ts`: Schema validation for project configs.
- `src/core/project-registry.test.ts`: Unit tests for resolution and validation.

## Data Flow
1. **Resolution:** CLI starts -> Check `--project` flag -> Check `minna.project.yaml` (CWD) -> Check `state/session.json` -> Fail if no project found.
2. **Selection:** `minna select <key>` -> Validate key exists in `projects.yaml` -> Write to `state/session.json`.
3. **Listing:** `minna projects` -> Load `projects.yaml` -> Filter by status (optional) -> Display in table format.

## Validation Approach
- **Unit Tests:**
  - Relative path resolution from different directory levels.
  - Validation of missing required fields.
  - Priority ordering of project resolution sources.
- **Smoke Tests:**
  - `minna select` followed by `minna status` (verifying session persistence).
  - `minna projects` displaying both active and archived projects.
