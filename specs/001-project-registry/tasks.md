# Tasks: Project Registry (001)

**Input**: Design documents from `/specs/001-project-registry/`
**Prerequisites**: plan.md, spec.md, research.md

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure for project types, session state, and validation.

- [ ] T001 [P] Update `src/core/types.ts` to include `ProjectStatus` enum and update `ProjectConfig` with the `status` field.
- [ ] T002 [P] Update `src/core/config.ts` to handle the new `status` field in `loadProjects` and `loadWorkflow`.
- [ ] T003 Implement session persistence in `src/core/session.ts` (load/save `state/session.json`).
- [ ] T004 Implement project metadata validation in `src/core/validation.ts` (required fields, key uniqueness, path format).
- [ ] T005 [P] Create `src/core/project-registry.test.ts` with failing tests for validation and resolution priority.

**Checkpoint**: Foundation ready - session management and validation logic are in place.

---

## Phase 2: User Story 1 - Central Project Registration (Priority: P1) 🎯 MVP

**Goal**: Support defining and loading projects from a central `projects.yaml`.

**Independent Test**: Create a `projects.yaml`, call `resolveProjectContext({ projectKey: 'id' })`, and verify the project is returned with correct path resolution.

### Implementation for User Story 1

- [ ] T006 [P] Update `resolveCentralProject` in `src/core/project-context.ts` to use the new validation logic.
- [ ] T007 [P] Ensure `normalizeProjectPath` correctly handles status and metadata from `projects.yaml`.
- [ ] T008 Add unit tests in `src/core/project-registry.test.ts` for central project loading and error cases (e.g., duplicate keys).

**Checkpoint**: Central project registration is fully functional and validated.

---

## Phase 3: User Story 2 - Embedded Project Discovery (Priority: P1) 🎯 MVP

**Goal**: Support automatic project discovery via `minna.project.yaml` in the CWD.

**Independent Test**: Place a `minna.project.yaml` in a sub-folder, call `resolveProjectContext()` from that folder, and verify it detects the embedded project.

### Implementation for User Story 2

- [ ] T009 Update `resolveEmbeddedProject` in `src/core/project-context.ts` to support the updated project schema and validation.
- [ ] T010 Update `resolveProjectContext` priority: 1. Flag, 2. Embedded (CWD), 3. Session State.
- [ ] T011 Add unit tests in `src/core/project-registry.test.ts` verifying that Embedded mode takes precedence over the (yet to be implemented) session state.

**Checkpoint**: Embedded project discovery is functional and respects resolution priority.

---

## Phase 4: User Story 4 - Project Selection & Persistence (Priority: P2)

**Goal**: Allow operators to select a project and persist it to `state/session.json`.

**Independent Test**: Run `minna select <key>`, then run `minna status` and verify it uses the selected project without a flag.

### Implementation for User Story 4

- [ ] T012 Add `select` command handler in `src/cli.ts` that validates the key and calls `saveSession`.
- [ ] T013 Update `resolveProjectContext` in `src/core/project-context.ts` to attempt resolution from `state/session.json` as a fallback.
- [ ] T014 Add integration test verifying the flow: `select` -> `save` -> `resolve` (without flag).

**Checkpoint**: Session-based selection persistence is operational.

---

## Phase 5: User Story 3 - Project Detail Inspection (Priority: P2)

**Goal**: CLI commands to list and view project details.

**Independent Test**: Run `minna projects` and `minna projects --view <key>` and verify formatted output.

### Implementation for User Story 3

- [ ] T015 Add `projects` command to `src/cli.ts` to list all projects from the central registry.
- [ ] T016 Implement detail view for a specific project in `src/cli.ts` (e.g., `minna projects --view <key>`).
- [ ] T017 [P] Update `printHelp` in `src/cli.ts` to include the new commands and flags.

**Checkpoint**: All user stories are complete and accessible via the CLI.

---

## Phase 6: Release Prep (Mandatory)

**Purpose**: Finalize documentation and versioning.

- [ ] T018 Update `package.json` version if required for this feature release.
- [ ] T019 Update `README.md` with instructions for `projects.yaml`, `minna.project.yaml`, and `minna select`.
- [ ] T020 Add entry to `CHANGELOG.md` for Feature 001: Project Registry.
- [ ] T021 Sanity check all documentation in `docs/` and `specs/` for consistency.

---

## Dependencies & Execution Order

1. **Phase 1 (Foundational)** is the critical path and must be completed first.
2. **Phase 2 and 3** can be worked on in parallel once Phase 1 is done.
3. **Phase 4** depends on the session infrastructure from Phase 1 and the resolution logic from Phase 2.
4. **Phase 5** depends on the command structure in `src/cli.ts`.
5. **Phase 6** is the final step before merging.
