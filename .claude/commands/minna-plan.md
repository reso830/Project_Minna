---
description: Write plan.md (and supporting artifacts) for a feature
argument-hint: [feature-id]
allowed-tools: Read, Write, Glob, Grep
---
Feature: $1

Do exactly as instructed in @scripts/prompts/minna-plan.md.

- Spec: @specs/$1-*/spec.md
- Constitution: @.specify/memory/constitution.md
- Write output to `specs/$1-*/plan.md` (+ supporting artifacts per the prompt's heuristic).

Do NOT assume missing information. Do NOT implement code. Limit the work to this feature.