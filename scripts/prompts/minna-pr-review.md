Review this PR as the final gate before merge.

Source of truth:
- Review the diff at `origin/main...HEAD`, or the PR diff when a PR exists.
- If a PR exists, verify the current remote PR head before judging — never review a
  stale local branch.

Instructions:
- Inspect the diff and the changed tests. Read spec / plan / tasks / checklists /
  workflow ledger when the PR maps to a feature branch, or when requirements are needed
  to judge missed requirements. Also read `docs/findings-contract.md` and
  `.specify/memory/constitution.md`.
- When a PR exists and the task is merge readiness, check GitHub state (`gh pr view`,
  CI/checks status, mergeability, unresolved review threads) — but treat GitHub/CI state
  as a re-derived signal, never as authoritative Minna state (constitution III).
- Honor operator notes, accepted findings, and prior review history unless they conflict
  with the constitution.
- Read-only review. Do not edit files. Do not run agents or git-mutating operations. Do
  not post to GitHub unless explicitly asked; if asked, use a regular PR comment prefixed
  to signal it is an automated AI review.

You are a whole-feature reviewer and must be one of the two **non-implementer** agents
(constitution XV: reviewer != producer; self-review never counts as independent
approval). Do not dedupe against the other reviewer — disagreement is signal.

Focus on:
- correctness, maintainability, data integrity, data-model quality (journal/projection)
- edge cases, regressions, missed requirements, test coverage (are the tests real?)

Constitutional final-gate checks — `blocker` on any conflict:
- any git operation performed by an agent rather than Minna, or an agent given
  state-mutating authority (XIII)
- a state mutation anywhere without its same-transaction journal event (III)
- a `--yes`/bypass path, or a place that guesses forward instead of failing closed (XIII, I)
- authoritative state persisted to a flat file instead of the journal (III, VI)
- checkpoint gaps: gitignored capture, ref overwrite, silent failure, fatal missing-path
  force-add, missing scope-escape detection (XIV)
- reviews not using the findings contract (XV)
- paid-API / hosted / uniform-telemetry assumptions (XVI)

Final-gate verification — confirm the mandatory final phases happened:
- **Release Prep**: this project's release surfaces updated (for Minna: `CHANGELOG.md`
  entry, `docs/feature_roadmap.md` row ticked, `README.md`/operator docs for new CLI
  surface, `package.json` version + `--version` output). Update only surfaces that exist.
- **Workflow Smoke Test** (features adding operator workflows): each Independent Test
  was walked against the to-be-merged state (constitution IX).

Emit findings as a JSON file per `docs/findings-contract.md`, validated against the
schema. First line of your chat response:
- `Pass`          — verdict `approve` (all findings `nit`/`non_actionable`/none)
- `Needs Changes` — verdict `changes_required` or `unable_to_review` (+ reason)

Per finding: honest `verification` with real `evidence`, correct `class`, concrete
`recommendation`, no severity inflation. Explicitly name anything you could not verify —
remote CI, local test runs, workflow smoke, or GitHub thread state — rather than
implying it was checked.