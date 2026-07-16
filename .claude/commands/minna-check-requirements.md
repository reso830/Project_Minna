---
description: Second-reviewer requirements check; executes the plan-review gate
argument-hint: [feature-id] [output-path]
allowed-tools: Read, Glob, Grep, Edit, Write
---
Feature: $1

Do exactly as instructed in @scripts/prompts/minna-check-requirements.md.

- Package: @specs/$1-*/ (spec, plan, tasks, contracts, data-model, checklist, ledger)
- Contract: @docs/findings-contract.md   Schema: @docs/findings-contract.schema.json
- Constitution: @.specify/memory/constitution.md
- Write the findings JSON to: $2  (default: specs/$1-*/reviews/check-requirements.json)

READ-ONLY except: you MUST execute and update `specs/$1-*/checklists/plan-review.md`, and you write the findings JSON at the output path. Edit NOTHING else. Reach your own findings; do not assume the other reviewer's.