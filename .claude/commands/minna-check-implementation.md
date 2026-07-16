---
description: Per-phase conformance review; emits a findings JSON file
argument-hint: [feature-id] [phase] [output-path]
allowed-tools: Read, Glob, Grep, Bash, Write
---
Feature: $1  Phase: $2

Do exactly as instructed in @scripts/prompts/minna-check-implementation.md, for feature $1 phase $2.

- Package + changed files: @specs/$1-*/
- Contract: @docs/findings-contract.md   Schema: @docs/findings-contract.schema.json
- Constitution: @.specify/memory/constitution.md
- Write the findings JSON to: $3  (default: specs/$1-*/reviews/phase-$2-review.json)

READ-ONLY of source. You may run the test/typecheck commands. Your only write is the findings JSON at the output path. Do not edit source, tests, specs, or tasks. Do not run agents or git-mutating operations.