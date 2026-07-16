Review this Spec Kit package as a software architect.

Instructions:
- Read the spec, plan, tasks, the `checklists/plan-review.md` checklist, and the workflow ledger if one exists.
- Also read the feature brief, `docs/findings-contract.md`, and `.specify/memory/constitution.md`.
- Honor operator notes, accepted findings, and prior review history unless they conflict with the constitution.
- This is a review only. Do not edit files. Do not run agents or git operations.

Emit your findings as a JSON file per `docs/findings-contract.md`, validated against
`docs/findings-contract.schema.json`, written to the path given to you. The first line
of your chat response is the header mapping from your verdict:
- `Ready`     — verdict `approve` (only `nit`/`non_actionable`/no findings)
- `Not Ready` — verdict `changes_required` or `unable_to_review` (+ reason)

Check for:
- unclear or untestable requirements
- missing acceptance criteria or missing Independent Tests
- missing edge cases and failure modes
- contradictions between spec, plan, and tasks
- overengineering (prefer deleting architecture — constitution XII)
- data-model risks in the event journal / projections
- testing gaps

Constitutional checks — raise a `blocker` for any conflict (constitution is supreme):
- Does the package give any agent a git-mutating or state-mutating capability? (XIII)
- Does it introduce a bypass / auto-approve path, or a `--yes`-style flag? (XIII)
- Does it derive authoritative workflow state from agent freeform text? (II)
- Does any state mutation lack a same-transaction journal event? (III)
- If it touches checkpoints: are gitignored-path capture and documented restore
  semantics specified, and is missing-path force-add tolerated not fatal? (XIV)
- If it touches reviews: does it use the findings contract, not an ad-hoc format? (XV)
- Does it assume paid APIs, hosted services, or uniform agent telemetry? (XVI)
- Is authoritative state kept as the SQLite event journal (not file-backed mutable
  state)? (III, VI)

For each finding follow the contract: honest `verification` (`checked` means you
actually inspected the artifact — cite it in `evidence`; do not assert), correct
`class` (a real concern the spec defers is `out_of_scope`, not a blocker), and no
severity inflation. Name explicitly anything you could not verify.