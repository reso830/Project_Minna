---
description: Architect review of a spec package; emits a findings JSON file
argument-hint: [feature-id] [output-path]
allowed-tools: Read, Glob, Grep, Write
---
Feature: $1

Do exactly as instructed in @scripts/prompts/minna-spec-review.md.

- Package: @specs/$1-*/ (spec, plan, tasks, checklists/plan-review.md, ledger if present)
- Contract: @docs/findings-contract.md   Schema: @docs/findings-contract.schema.json
- Constitution: @.specify/memory/constitution.md
- Write the findings JSON to: $2  (default: specs/$1-*/reviews/spec-review.json)

This is READ-ONLY of the package. Your ONLY write is the findings JSON at the output path. Do not edit any spec/plan/tasks/source file. Do not run agents or git operations.