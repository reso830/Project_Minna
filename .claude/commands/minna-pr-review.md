---
description: Final whole-feature PR review gate; emits a findings JSON file
argument-hint: [feature-id] [output-path]
allowed-tools: Read, Glob, Grep, Bash, Write
---
Feature: $1

Do exactly as instructed in @scripts/prompts/minna-pr-review.md, for feature $1 (PR on its branch).

- Diff: origin/main...HEAD (verify the remote PR head if a PR exists)
- Package: @specs/$1-*/
- Contract: @docs/findings-contract.md   Schema: @docs/findings-contract.schema.json
- Constitution: @.specify/memory/constitution.md
- Write the findings JSON to: $2  (default: specs/$1-*/reviews/pr-review.json)

You must be a NON-implementer of this feature. READ-ONLY: you may run tests and read GitHub/CI state, but treat GitHub/CI as a re-derived signal, not authoritative state. Your only write is the findings JSON. Do not edit files, do not post to GitHub unless explicitly asked.