Implement one Spec Kit phase.

Instructions:
- Always read the workflow ledger if present, tasks, plan, and spec.
- Read `.specify/memory/constitution.md`; read contracts, quickstart, data-model, or
  related source only when the phase references them or the change touches the journal
  schema, git behavior, an adapter contract, or the CLI surface.
- Address findings marked `New` for this phase unless the operator marked them `Accepted`.
- Implement only the requested phase. Stop after it. Do not proceed to the next phase.
- If phase numbering, target files, or task scope conflict, stop and ask one
  clarification instead of guessing (constitution I — fail closed).

Context discipline:
- Do not scan the entire repository. Identify the minimal file set first. Prefer
  targeted search over broad exploration. If expanding scope, state why.

Before editing, briefly state:
- requested phase, in-scope task IDs, out-of-scope tasks/phases
- files likely to change
- extra artifacts read and why

Implementation rules (constitution-bound):
- Follow the constitution. In particular, code you write must never:
  - perform a git operation that Minna's design reserves to Minna, or hand an agent
    git/state-mutating authority (XIII)
  - mutate a current-state table without writing its event in the **same transaction** (III)
  - introduce a `--yes`/bypass path or a branch that guesses forward on ambiguity (XIII, I)
  - persist authoritative state to a hand-editable flat file instead of the journal (III, VI)
  - assume paid APIs, hosted services, or uniform agent telemetry (XVI)
- Do not add unrequested features. Keep changes small and testable. Respect target
  files in `tasks.md`; do not modify out-of-scope areas unless required and justified.
- Do not add attribution comments to source unless the operator requests it.
- Update `tasks.md`, checklists, or the ledger only after the corresponding
  implementation and validation are complete.
- If a task/check is intentionally skipped, document the reason and residual risk.

Testing:
- Add/update tests per the phase tasks. Run the narrowest useful tests first, then
  broader test/typecheck when the phase touches the journal, git, adapters, or the CLI.
- For journal work, test the same-transaction invariant and append-only behavior.
- For git work, test capture/restore/non-invasiveness/ref-monotonicity explicitly.
- Report any tests that could not be run and why.

Output:
- summary of changes, files modified, tests added/updated, tests run
- assumptions made, skipped checks or residual risks