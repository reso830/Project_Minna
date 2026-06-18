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

- **I. Human Authority:** CLI commands act strictly under explicit human instruction (editing YAML files, selecting projects, or running register/select commands).
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
- `src/core/types.ts`: Add `ProjectStatus` enum and update `ProjectConfig` with the optional `status` field.
- `src/core/project-context.ts`: Integrate session resolution, check physical directory existence on context resolution (throw error if missing), and check relative paths.
- `src/core/config.ts`: Use `parseDocument` to load configs and throw on duplicate key validation errors.
- `src/cli.ts`: Add `register`, `select`, `projects` commands, adding support for flags like `--status` and `--force`.

### Files to Create
- `src/core/session.ts`: Logic for reading/writing `state/session.json`.
- `src/core/validation.ts`: Schema validation for project configs (validates fields, path syntax, and status values, defaulting status to 'active').
- `src/core/project-registry.test.ts`: Unit tests for resolution, validation, duplicate checking, and directory checking.

## Data Flow
1. **Resolution:** CLI starts -> Check `--project` flag -> Check `minna.project.yaml` (CWD) -> Check `state/session.json` -> Validate that the resolved project directory exists on disk -> Fail if no project found or directory is missing.
2. **Selection:** `minna select <key>` -> Validate key exists and is valid -> Write to `state/session.json`.
3. **Listing:** `minna projects` -> Load `projects.yaml` using AST parse checking for duplicates -> Filter by status (optional via `--status` flag) -> Warn to stderr for any listed projects with missing directories -> Display in table format.
4. **Registration:** `minna register --key <key> --name <name> --path <path> [--github <github>] [--speckit-dir <speckit-dir>] [--status <status>] [--default-branch <branch>] [--force]` -> Validate inputs -> Load registry as document -> Check for duplicate key -> Check path directory exists on disk (unless `--force` specified) -> Insert new node preserving YAML AST format -> Write back to `projects.yaml`.

## Validation Approach
- **Unit Tests:**
  - Parse-time duplicate key detection throws errors.
  - Required fields and invalid status validation.
  - Defaulting status to `active` when omitted.
  - Path formatting vs directory existence warning on listing vs fatal error on resolution/registration.
  - Relative path resolution from different directory levels.
  - Priority ordering of project resolution sources.
- **Smoke Tests:**
  - `minna register` creates or appends to `projects.yaml`.
  - `minna select` followed by `minna status` (verifying session persistence).
  - `minna projects` displaying projects with optional status filtering.
