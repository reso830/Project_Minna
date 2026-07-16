Review one implemented Spec Kit phase (conformance check).

Instructions:
- Read the workflow ledger, phase tasks, plan, spec, and the changed files.
- Also read `docs/findings-contract.md` and `.specify/memory/constitution.md`.
- Scope the review to the diff this phase introduced (per the ledger / phase commit
  range), not the whole branch.
- Run the project's test command and typecheck (per the plan; typically
  `npm run test` and `npx tsc --noEmit`). A phase must leave the tree green — treat any
  test or typecheck failure as `blocker`. Confirm no earlier-phase behavior regressed.
- Judge this phase against its declared tasks only. Do NOT flag as missing any work the
  plan or a later phase explicitly defers.
- Honor operator notes, accepted findings, and prior review history unless they conflict
  with the constitution.
- Read-only review of source. Do not edit source, tests, specs, tasks, or the ledger
  (running tests/typecheck is allowed). Do not run agents or git-mutating operations.

This is the per-phase **conformance check** (constitution Development Workflow): does
this phase match the plan, are the interfaces/contracts what the spec declared, did it
stay in scope, are the tests real? Catch foundation errors early — a wrong abstraction
here compounds across later phases.

Emit findings as a JSON file per `docs/findings-contract.md`, validated against the
schema. First line of your chat response:
- `Pass`          — verdict `approve`
- `Needs Changes` — verdict `changes_required` or `unable_to_review` (+ reason)

Review for:
- correctness and maintainability
- data-model quality (journal events, projections, same-transaction writes)
- test coverage (are the tests real, or do they assert nothing?)
- missed phase tasks
- unintended out-of-scope changes — verify changed files match the phase tasks' target
  files and the plan's `Affected Areas`; flag any file modified that no task authorized
  (`class: out_of_scope` if it's a real concern beyond this phase)

Constitutional checks — `blocker` on any conflict:
- Any git operation performed by an agent rather than by Minna? (XIII)
- Any agent given state-mutating authority (transitioning state, closing its own
  findings, writing journal events directly)? (XIII, XV)
- A state mutation without its same-transaction journal event? (III)
- A checkpoint path that fails to capture configured gitignored paths, overwrites an
  existing ref, fails silently, or crashes on a missing force-add path? (XIV)
- File-backed mutable state where the journal should be authoritative? (III, VI)
- A `--yes` / bypass path, or a place that guesses forward instead of failing closed? (XIII, I)

Follow the contract for each finding: honest `verification` (mark `checked` only if you
read the code or ran the command, and put what you observed in `evidence`), correct
`class`, concrete `recommendation`, no severity inflation. Name anything you could not
verify (tests not run, environment gaps).