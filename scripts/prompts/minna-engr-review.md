Review this Spec Kit package as the ENGINEER who must implement it against the CURRENT
codebase (engineer lens).

Your altitude is the keyboard. Ask: will this actually build and run? Do the contracts
match what the code would really expose? Are the target files real? Do the tasks reference
scripts/files that exist? Does it collide with existing scaffold (e.g. `src/core/state.ts`,
`src/core/workflow.ts`, `workflows/speckit-feature.yaml`)? Are the acceptance tests actually
runnable in this environment (tooling present, versions available)? Prioritize buildability
and codebase-grounded feasibility over abstract design critique — the architect review
covers design soundness.

Instructions:
- Read spec, plan, tasks, contracts, data-model, quickstart, `checklists/plan-review.md`,
  the ledger, the feature brief, `docs/findings-contract.md`, and
  `.specify/memory/constitution.md`.
- Inspect the ACTUAL codebase where the plan claims to touch it — verify target files and
  scripts exist and that referenced tooling/versions are available.
- Honor operator notes/accepted findings/prior history unless they conflict with the constitution.
- Read-only for source, spec, plan, tasks, ledger. The ONE exception is
  `checklists/plan-review.md`, which you MUST execute (below) and may edit only that file.
  Do not run agents or git-mutating operations.

Note: you are the SECOND, independent reviewer. Do not assume the architect's findings;
reach your own. Overlap is fine — disagreement between the two lenses is signal, not noise.

Check for:
- blockers to implementation; nonexistent target files/scripts; missing/unavailable tooling
- contracts that won't match real code; type-level issues; version/dependency gaps
- collisions with existing scaffold; unscoped edits to superseded files
- untestable acceptance criteria; tests that can't actually run here
- cross-artifact drift between spec, plan, tasks, contracts, data-model, checklist, roadmap
- (watch for pre-M0 naming or file-backed-state assumptions leaking back in)

Constitutional checks — `blocker` on any conflict: as in the architect review, plus
concrete build-level violations (a task that has an agent run git; a write path that
mutates a table without its same-transaction event; a `--yes` path).

## Execute the plan-review gate

`checklists/plan-review.md` is a pre-implementation gate created empty; no later step fills
it in. Work every item: verify against the artifacts AND the real codebase; `[x]` if it
holds; leave `[ ]` and raise a matching finding if it does not or you cannot confirm it.
Never tick an item you could not verify. Set a top line: `**Gate result**: PASS` or
`**Gate result**: FAIL — open: <item numbers>`, plus the date.

**The findings JSON is canonical; the checklist is a PASS/FAIL view over its mandatory items.**
Every open (`[ ]`) checklist item MUST have a corresponding finding in the JSON — the two can
never disagree. FAIL gate ⇒ JSON `changes_required` (or `unable_to_review`); PASS gate with
no other findings ⇒ JSON `approve`.

Emit findings as a JSON file per `docs/findings-contract.md`, validated against the schema,
written to: `specs/<feature>/reviews/r<n>-engr-review.json` (default round r1). First line of
your chat response:
- `Ready`     — verdict `approve` (and gate PASS)
- `Not Ready` — verdict `changes_required` / `unable_to_review`, or any gate item open for a real gap

After the verdict, in chat: state the gate result (PASS / FAIL + open items) and a brief
`Artifacts reviewed` list. Per finding: honest `verification` with real `evidence`, correct
`class`, no inflation.