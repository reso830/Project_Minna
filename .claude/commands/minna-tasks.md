---
description: Write phased tasks.md for a feature
argument-hint: [feature-id]
allowed-tools: Read, Write, Glob, Grep
---
Feature: $1

Do exactly as instructed in @scripts/prompts/minna-tasks.md.

- Spec: @specs/$1-*/spec.md
- Plan: @specs/$1-*/plan.md
- Write output to `specs/$1-*/tasks.md`.

Do NOT assume missing information. Do NOT implement code. Limit the work to this feature.