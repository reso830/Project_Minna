# Project Minna Constitution

## Core Principles

### I. Human Authority & Decision-Making

Humans decide, Minna coordinates.

Humans are solely responsible for:

* Product direction
* Architectural decisions
* Prioritization
* Acceptance decisions
* Release decisions

Minna may coordinate, summarize, recommend, and assist, but must not become an autonomous decision-maker.

Recommendations must always remain distinguishable from decisions.

---

### II. Deterministic Orchestration

Minna is a deterministic orchestration platform, not an autonomous agent framework.

Workflows must remain:

* Deterministic
* Auditable
* Explainable
* Observable

Workflow transitions must be explicit.

State changes must be traceable.

Automation must never become a black box.

---

### III. State Is The Source Of Truth

Minna is the authoritative source of truth for:

* Projects
* Features
* Workflow state
* Decisions

External systems may provide signals and metadata but must not become the authoritative source of orchestration state.

State should be persisted and recoverable whenever practical.

Workflow state should not be reconstructed from external systems when authoritative state already exists within Minna.

---

### IV. Thin Interfaces & Core Logic

Business logic belongs in core services.

Interfaces exist to consume orchestration services.

CLI, MCP, web interfaces, and future conversational interfaces must remain thin wrappers around shared business logic.

Preferred architecture:

```text
Interfaces
    ↓
Core Services
    ↓
State Layer
```

Business logic must not be duplicated across interfaces.

---

### V. MCP-Ready, Not Required

Minna should support future MCP-based integrations without requiring MCP for basic operation.

The platform must remain fully functional through local execution and local configuration.

No core capability should depend exclusively on MCP.

---

### VI. Local-First Simplicity

Prefer local-first solutions whenever practical.

State should remain:

* Human-readable
* Portable
* Easy to inspect
* Easy to recover

Minimize infrastructure requirements.

Avoid introducing external systems before a demonstrated need exists.

Single-operator workflows should be optimized before multi-user workflows are considered.

---

### VII. Documentation Discipline

Documentation is part of the deliverable.

A feature is not complete until all impacted documentation has been updated.

Documentation may include:

* README
* CHANGELOG
* Roadmap
* Feature Briefs
* Architecture Documentation
* Operator Guides

Documentation must accurately reflect actual system behavior.

---

### VIII. Mandatory Release Preparation

Implementation completion alone does not constitute feature completion.

Every feature must complete release preparation before acceptance.

Release preparation includes:

1. Acceptance criteria verification
2. Documentation review and updates
3. Release note preparation
4. CHANGELOG updates
5. Validation of impacted operator workflows

A feature is not considered complete until release preparation has been completed.

---

### IX. Workflow Smoke Testing

Every feature must define and execute smoke tests appropriate to its scope.

Smoke tests should focus on critical operator workflows and regression prevention.

Examples include:

* Project registration
* Feature creation
* Workflow advancement
* Decision recording
* State retrieval

Smoke tests should remain lightweight, repeatable, and practical to execute.

---

### X. Context Preservation

Project knowledge should survive:

* Feature completion
* Agent handoffs
* Project pauses
* Contributor changes

Decisions, workflow history, project context, and operational knowledge should be preserved whenever practical.

Minna should reduce context loss rather than contribute to it.

---

### XI. Dogfooding (Minna Builds Minna)

Minna should preferentially use its own capabilities whenever practical.

The project should progressively manage its own development lifecycle through Minna.

Temporary exceptions are acceptable when functionality does not yet exist, but should be revisited as the platform matures.

If Minna cannot successfully orchestrate its own evolution, it is not ready to orchestrate other projects.

---

### XII. Simplicity Before Scale

Build for current requirements rather than hypothetical future requirements.

Prefer:

* Clarity over cleverness
* Maintainability over abstraction
* Practicality over speculation

Premature optimization, speculative architecture, and "just-in-case" complexity should be avoided.

Refactor for scale only when evidence demonstrates the need.

---

## Development Workflow

### Feature Lifecycle

All development follows the SpecKit lifecycle:

```text
specify
→ clarify
→ plan
→ tasks
→ implement
→ test
→ review
→ manual_acceptance
```

### Quality Gates

Changes must be supported by evidence.

Features require specifications.

Implementations require validation.

Acceptance requires verification.

No feature is complete without demonstrating that the intended behavior works as expected.

---

## Governance

This Constitution is the supreme governance document for Project Minna.

It supersedes local conventions, implementation preferences, and workflow habits.

All specifications, plans, tasks, implementations, and reviews must comply with this Constitution.

Amendments should be infrequent, deliberate, and documented through the project's decision logging process.

---

**Version:** 1.1.0
**Ratified:** 2026-06-17
**Last Amended:** 2026-06-17
