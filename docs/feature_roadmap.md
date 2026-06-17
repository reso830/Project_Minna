# Minna Roadmap

> Canonical product roadmap and development direction for Project Minna.

---

# Vision

Minna is a deterministic orchestration platform for AI-assisted software development.

Its purpose is to reduce the operational overhead of managing projects, workflows, AI agents, reviews, and development context while keeping humans responsible for direction, prioritization, and approval.

Core philosophy:

* Humans decide, Minna coordinates
* Deterministic orchestration over autonomous agents
* Visibility over black-box automation
* Context should be preserved
* Process should be enforced consistently

---

# Product Direction

Minna is evolving through six major phases:

| Version | Theme                             | Status  |
| ------- | --------------------------------- | ------- |
| 1.0.0   | Workflow Foundations              | Planned |
| 2.0.0   | Development Coordination          | Planned |
| 3.0.0   | Context & Knowledge               | Planned |
| 4.0.0   | Integration Platform              | Planned |
| 5.0.0   | Conversational Minna              | Planned |
| 6.0.0   | Self-Hosting Development Platform | Planned |

---

# 1.0.0 — Workflow Foundations

> Understand projects, features, and workflows.

## Goals

* Establish project awareness
* Support Spec Kit workflows
* Track feature lifecycle state
* Capture operator decisions
* Build operational foundations

## Features

* [ ] 001-project-registry
* [ ] 002-feature-registry
* [ ] 003-workflow-engine
* [ ] 004-state-management
* [ ] 005-decision-log
* [ ] 006-operator-cli

---

# 2.0.0 — Development Coordination

> Coordinate development activities and approvals.

## Goals

* Coordinate human and AI contributors
* Formalize review workflows
* Introduce governance controls
* Improve delivery visibility

## Features

* [ ] 007-policy-and-approval-gates
* [ ] 008-agent-registry
* [ ] 009-agent-assignment
* [ ] 010-review-workflows
* [ ] 011-github-awareness

---

# 3.0.0 — Context & Knowledge

> Preserve and leverage project knowledge.

## Goals

* Eliminate context loss
* Preserve project history
* Improve handoffs
* Support historical discovery

## Features

* [ ] 012-project-memory
* [ ] 013-context-builder
* [ ] 014-architecture-decision-records
* [ ] 015-knowledge-search

---

# 4.0.0 — Integration Platform

> Become the coordination hub for development tooling.

## Goals

* Standardize agent integrations
* Reduce manual coordination
* Expose project context programmatically
* Support future tooling expansion

## Features

* [ ] 016-agent-adapters
* [ ] 017-mcp-server
* [ ] 018-external-tool-integration

---

# 5.0.0 — Conversational Minna

> Make orchestration accessible through conversation.

## Goals

* Reduce operational friction
* Improve visibility
* Provide actionable recommendations
* Establish Minna's personality

## Features

* [ ] 019-conversational-interface
* [ ] 020-status-briefings
* [ ] 021-recommendation-engine
* [ ] 022-persona-framework

---

# 6.0.0 — Self-Hosting Development Platform

> Use Minna to build and manage future projects.

## Goals

* Accelerate project creation
* Standardize development workflows
* Dogfood Minna's capabilities
* Reduce setup overhead

## Features

* [ ] 023-project-bootstrap
* [ ] 024-feature-brief-generator
* [ ] 025-speckit-bootstrap
* [ ] 026-self-orchestration

---

# Guiding Principles

## Humans Decide, Minna Coordinates

Minna should coordinate work, not replace decision-making.

The system may:

* track
* summarize
* recommend
* coordinate

But humans remain responsible for:

* priorities
* approvals
* architecture decisions
* product direction

---

## Deterministic Over Autonomous

Minna is an orchestrator, not an autonomous coding agent.

Agents may generate work.

Minna manages:

* workflow state
* approvals
* context
* coordination

---

## Context Should Persist

Project knowledge should survive:

* feature completion
* agent handoffs
* project pauses
* contributor changes

---

## Visibility Matters

Operators should always understand:

* what is happening
* why it is happening
* what is blocked
* what comes next

---

## Dogfood Everything

Minna should eventually manage its own development lifecycle.

If Minna cannot successfully orchestrate Minna, it is not ready to orchestrate other projects.

---

# Notes

* This roadmap is directional, not contractual.
* Feature ordering may evolve as implementation progresses.
* Smaller operational or infrastructure tasks may exist outside this roadmap.
* Future versions may be adjusted as the orchestration model matures.
