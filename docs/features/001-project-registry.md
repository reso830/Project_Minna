# 001-project-registry

## Feature Overview

Project Registry establishes the foundation for project awareness within Minna.

It allows operators to register, discover, and manage projects that Minna can orchestrate. The registry serves as the entry point for workflow execution, feature tracking, and future agent coordination.

This feature supports both centralized project management and embedded project configurations.

---

## Goals

* Establish a canonical list of managed projects
* Support project discovery and selection
* Enable future workflow execution against registered projects
* Provide a consistent foundation for orchestration activities

---

## User Stories

### Primary User Story

As an operator,

I want Minna to know about my projects,

so that features, workflows, and decisions can be managed within the correct project context.

### Supporting User Stories

As an operator,

I want to register a project with Minna,

so that it becomes available for orchestration.

As an operator,

I want to view all registered projects,

so that I can quickly understand what Minna is managing.

As an operator,

I want Minna to identify the active project,

so that I do not need to repeatedly provide project information.

---

## Functional Requirements

### Project Registration

Operators shall be able to register projects with Minna.

Each project shall contain:

* Project identifier
* Project name
* Project path
* Project description (optional)
* Project status

### Project Discovery

Operators shall be able to:

* List registered projects
* View project details
* Select an active project

### Project Resolution

Minna shall support:

* Central registry mode
* Embedded project mode

### Validation

Minna shall validate:

* Duplicate project identifiers
* Missing required metadata
* Invalid project paths

---

## Acceptance Criteria

* Operators can register projects
* Operators can list projects
* Operators can view project metadata
* Operators can select an active project
* Duplicate registrations are prevented
* Invalid project definitions are rejected

---

## Out of Scope

* GitHub integration
* Feature tracking
* Workflow execution
* Agent coordination
* Project creation

---

## Dependencies

None

---

## Release Notes

Introduces the foundational project registry used by all future Minna functionality.
