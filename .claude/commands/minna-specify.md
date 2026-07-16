---
description: Write the Spec Kit spec.md for a feature from its brief
argument-hint: [feature-id]
allowed-tools: Read, Write, Glob, Grep
---
Feature: $1

Do exactly as instructed in @scripts/prompts/minna-specify.md.

- Feature brief: @docs/features/**/$1-*.md
- Constitution: @.specify/memory/constitution.md
- Findings contract (if reviews are in scope): @docs/findings-contract.md
- Write output to `specs/$1-*/spec.md`.

Ask clarifying questions where the brief is ambiguous. Do NOT assume. Limit the work to this feature only.