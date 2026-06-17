# Feature Specification: Project Registry

**Feature Branch**: `001-project-registry`  
**Created**: 2026-06-17  
**Status**: Draft  
**Input**: User description: "Project Registry: establishes the foundation for project awareness within Minna."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Central Project Registration (Priority: P1)

As an operator, I want to define a list of projects in a central configuration file so that Minna can manage multiple projects from a single orchestrator instance.

**Why this priority**: Foundational for "Central Mode" orchestration, allowing the operator to oversee a portfolio of projects.

**Independent Test**: Can be tested by creating a `projects.yaml` file, running a "list" command, and verifying that the projects are correctly identified and displayed.

**Acceptance Scenarios**:

1. **Given** a valid `projects.yaml` with multiple project entries, **When** the operator requests a project list, **Then** all projects are displayed with their IDs and names.
2. **Given** a `projects.yaml` with a relative path for a project, **When** Minna resolves the project, **Then** the path is correctly resolved relative to the configuration file location.

---

### User Story 2 - Embedded Project Discovery (Priority: P1)

As an operator, I want Minna to automatically recognize the current project when I am working inside a target project directory, so that I don't have to specify the project key for every command.

**Why this priority**: Essential for "Embedded Mode," providing a seamless local-first experience.

**Independent Test**: Can be tested by placing a `minna.project.yaml` in a directory, running a status command from that directory, and verifying Minna identifies the project automatically.

**Acceptance Scenarios**:

1. **Given** a `minna.project.yaml` in the current working directory, **When** an operator runs a command without a `--project` flag, **Then** Minna executes the command in the context of the embedded project.
2. **Given** both a central `projects.yaml` and a local `minna.project.yaml`, **When** running a command locally, **Then** the local project takes precedence.

---

### User Story 3 - Project Detail Inspection (Priority: P2)

As an operator, I want to view detailed metadata about a specific project so that I can verify its path, GitHub integration status, and other configuration details.

**Why this priority**: Important for debugging configuration issues and verifying context before performing destructive actions.

**Independent Test**: Can be tested by running a "view" command for a specific project key and asserting all metadata fields are present and correct.

**Acceptance Scenarios**:

1. **Given** a registered project key, **When** the operator requests project details, **Then** the system displays ID, Name, Path, and optional fields like GitHub repo.

---

### User Story 4 - Project Selection (Priority: P2)

As an operator working in Central Mode, I want to explicitly select a project to work on for the current session.

**Why this priority**: Necessary for operators managing many projects from a single shell session.

**Independent Test**: Can be tested by passing a `--project` flag to a command and verifying the command is scoped only to that project.

**Acceptance Scenarios**:

1. **Given** multiple registered projects, **When** the operator provides a valid `--project` flag, **Then** all subsequent context-aware logic is applied to that specific project.
2. **Given** an invalid project key via `--project`, **When** the operator runs a command, **Then** Minna rejects the command with a "Project not found" error.

### Edge Cases

- **Duplicate Keys:** How does the system handle multiple projects with the same ID in `projects.yaml`? (Expectation: Reject with error).
- **Broken Paths:** How does the system handle a project whose `path` no longer exists on disk? (Expectation: Warn but allow listing).
- **Missing Config:** What happens if neither a central nor an embedded config is found? (Expectation: Guide the user to initial setup).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support a central project registry via `projects.yaml` in the orchestrator root.
- **FR-002**: System MUST support embedded project configuration via `minna.project.yaml` in target project roots.
- **FR-003**: System MUST resolve relative project paths relative to the configuration file that defined them.
- **FR-004**: System MUST validate that every project has a unique key, a name, and a valid path format.
- **FR-005**: System MUST provide a CLI command to list all registered projects.
- **FR-006**: System MUST prioritize `minna.project.yaml` detection over central registry entries when running in a local directory.
- **FR-007**: System MUST allow overriding the active project via a `--project` or `-p` flag.
- **FR-008**: System MUST support a rich project status lifecycle including `active`, `paused`, and `completed`.
- **FR-009**: System MUST persist the active project selection in a local state file for operators working in Central Mode, allowing them to omit the `--project` flag in subsequent commands.

### Key Entities *(include if feature involves data)*

- **Project**: Represents a target application or repository managed by Minna.
  - `key`: Unique machine-readable identifier.
  - `name`: Human-readable display name.
  - `path`: File system path to the project root.
  - `speckit_dir`: Directory for SpecKit metadata (e.g., `.specify`).
  - `status`: Current lifecycle state (`active`, `paused`, `completed`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Operators can list all registered projects in under 1 second.
- **SC-002**: Project resolution (identifying the active project) adds less than 100ms of overhead to any CLI command.
- **SC-003**: 100% of invalid project definitions (missing required fields or duplicate keys) are caught during initialization.
- **SC-004**: Operators can successfully switch contexts between two projects in under 5 seconds using CLI flags.

## Assumptions

- **Local Storage:** Project registries are stored as local YAML files; no database is required for Phase 1.
- **Operator Knowledge:** Operators have basic knowledge of the file system paths where their projects are located.
- **Single Machine:** The registry is intended for use on a single operator machine (no cross-machine synchronization in scope).
- **Path Validity:** A project's path is considered valid if it is a string that resolves to a directory (even if empty).
