# 006-operator-cli

## Feature Overview

Operator CLI provides the primary interaction model for Minna.

It allows operators to manage projects, features, workflows, and decisions through a consistent command-line interface while exercising the core orchestration services introduced in v1.0.0.

The CLI serves as the first operational surface of Minna and is intentionally designed to remain thin, delegating business logic to underlying core services.

---

## Goals

* Provide a usable operator experience
* Enable workflow management through commands
* Validate orchestration capabilities
* Exercise core platform services
* Establish a foundation for future interfaces

---

## User Stories

### Primary User Story

As an operator,

I want to interact with Minna through a command-line interface,

so that I can manage projects, workflows, and decisions efficiently.

### Supporting User Stories

As an operator,

I want to view project and feature status,

so that I understand current progress.

As an operator,

I want to advance workflow phases,

so that work can move through the delivery lifecycle.

As an operator,

I want to create and manage project records,

so that Minna remains up to date.

As an operator,

I want a consistent command structure,

so that Minna is easy to learn and operate.

---

## Functional Requirements

### Project Commands

Operators shall be able to:

* Register projects
* List projects
* View project details
* Select active projects

### Feature Commands

Operators shall be able to:

* Create features
* List features
* View feature details

### Workflow Commands

Operators shall be able to:

* View workflow status
* Advance workflow phases
* Inspect workflow history

### Decision Commands

Operators shall be able to:

* Record decisions
* View decisions
* Browse decision history

### Status Commands

Operators shall be able to view:

* Active project
* Active features
* Workflow progress
* Recent activity

### Architectural Constraint

Business logic shall reside within core services.

The CLI shall act primarily as an interface layer.

---

## Acceptance Criteria

* Operators can perform core project operations through the CLI
* Operators can perform core feature operations through the CLI
* Operators can manage workflow progression through the CLI
* Operators can manage decisions through the CLI
* CLI output is clear and actionable
* Business logic remains separated from CLI concerns

---

## Out of Scope

* MCP integration
* Conversational interfaces
* Web UI
* Authentication
* Multi-user capabilities

---

## Dependencies

* 001-project-registry
* 002-feature-registry
* 003-workflow-engine
* 004-state-management
* 005-decision-log

---

## Release Notes

Introduces the first operator-facing experience for Minna and provides access to all v1.0.0 orchestration capabilities through a command-line interface.
