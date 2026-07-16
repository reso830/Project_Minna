---
description: Implement ONE phase of a feature
argument-hint: [feature-id] [phase]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---
Feature: $1  Phase: $2

Do exactly as instructed in @scripts/prompts/minna-implement-phase.md, for feature $1 phase $2.

- Spec/plan/tasks/ledger: @specs/$1-*/
- Constitution: @.specify/memory/constitution.md

Implement ONLY phase $2. Stop after it; do not proceed to the next phase. Respect target files in tasks.md. If scope/numbering conflicts, stop and ask one clarification (fail closed).