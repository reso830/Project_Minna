Create a Spec Kit specification for this feature.

Instructions:
- Read the feature brief and any design reference before writing.
- Read `.specify/memory/constitution.md`.
- Base the spec only on provided files and existing project context.
- Do not assume missing information. Do not implement code.

Write or update:
- `spec.md` in the feature directory (`specs/###-name/`)

Use this standard skeleton (match recent specs in `specs/`):
- Header block: `Feature Branch`, `Created`, `Status`, `Input: <brief path>`
- `## Clarifications` — before finalizing, scan the brief for ambiguities (scope
  boundaries, data shape, edge-case behavior, failure modes, CLI surface, journal
  event shape). Ask the operator up to 5 targeted, high-impact questions — never guess
  to fill a gap. Encode answers as dated `### Session YYYY-MM-DD` blocks of
  `Q: … → A: …`. If the operator is unavailable, list unresolved items as open
  questions that block the spec rather than assuming an answer.
- `## Problem Statement`
- `## Scope` — explicit **In scope** and **Non-goals**. Be thorough with Non-goals;
  they are the primary scope-control tool and every feature needs them.
- Behavior (CLI commands, inputs, outputs, exit codes)
- Acceptance criteria
- Edge cases and failure modes
- Data considerations (journal events, tables, and their relationship)

Requirements:
- Tie acceptance criteria to independently testable behaviors. Each must have an
  **Independent Test** — a concrete command or script that verifies it. Minna has no
  browser; tests are CLI invocations, journal-state assertions, and git-state
  assertions.
- Respect the constitution. In particular, verify the spec does not:
  - give any agent a git-mutating or state-mutating capability (XIII)
  - introduce a bypass / auto-approve / `--yes` path (XIII)
  - derive authoritative state from agent freeform text (II)
  - mutate current-state tables without a same-transaction event (III)
  - persist authoritative state to a hand-editable flat file instead of the journal (III, VI)
  - assume paid APIs, hosted services, or uniform agent telemetry (XVI)
- If the feature touches checkpoints, the spec must state restore semantics (XIV) and
  gitignored-path capture (XIV).
- If the feature touches reviews, it uses the findings contract
  (`docs/findings-contract.md`), not an ad-hoc format (XV).

Keep the spec concise, testable, and constitution-aligned.