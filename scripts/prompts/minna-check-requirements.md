Review this Spec Kit package as a software engineer (second independent reviewer).

Instructions:
- Read the spec, plan, tasks, the `checklists/plan-review.md` checklist, and the
  workflow ledger if one exists. Also read contracts, quickstart, data-model, the
  feature brief, `docs/findings-contract.md`, and `.specify/memory/constitution.md`
  when they exist and define behavior, contracts, validation, or scope.
- Honor operator notes, accepted findings, and prior review history unless they
  conflict with the constitution.
- Read-only for source, tests, spec, plan, tasks, and the ledger. The **one exception**
  is `checklists/plan-review.md`, which is your worksheet: you MUST execute it (below)
  and may edit only that file. Do not run agents or git-mutating operations.

You are the *second* reviewer of the spec package (constitution: two-reviewer spec
gate). Do not assume the first reviewer's findings; reach your own. Overlap is fine —
disagreement is signal and is not to be suppressed.

Check for:
- unclear requirements, blockers to implementation, missing acceptance criteria
- contradictions, risky assumptions, missing validation or tests
- cross-artifact drift between spec, plan, tasks, contracts, data-model, checklist,
  brief, and roadmap
- missing target files, nonexistent scripts, unclear task ownership, untestable criteria
- feature number/name mismatches and stale references (note: this repo was realigned
  post-M0 — watch for pre-M0 naming or file-backed-state assumptions leaking in)

Constitutional review — `blocker` on any conflict:
- agent given git or state-mutating authority (XIII)
- state mutation without a same-transaction event (III)
- bypass/`--yes` path, or guessing forward instead of failing closed (XIII, I)
- authoritative state as a flat file rather than the journal (III, VI)
- reviews not using the findings contract; reviewer == producer (XV)
- checkpoint gaps: gitignored capture, ref overwrite, silent failure, fatal missing-path
  force-add (XIV)
- paid-API / hosted / uniform-telemetry assumptions (XVI)

## Execute the plan-review gate

`checklists/plan-review.md` is a pre-implementation gate that MUST be completed during
this review — it is created with empty boxes and no later step fills it in. Work every
item:
- Verify each against the spec, plan, tasks, contracts, and other artifacts.
- If it holds, mark `[x]`. If it does not hold or you cannot confirm it, leave `[ ]` and
  raise a corresponding finding (severity by impact). Never tick an item you could not
  verify.
- Set a one-line result at the top: `**Gate result**: PASS` (every item checked) or
  `**Gate result**: FAIL — open: <item numbers>`, plus the date.

Editing only `checklists/plan-review.md` is expected here and does not violate read-only.

## The findings JSON is canonical; the checklist is a view over it

To avoid two divergent review records (constitution XII, XV — the findings contract is
the single review output format):
- The **findings JSON is the canonical, complete record** of this review.
- `checklists/plan-review.md` is a **PASS/FAIL view over the mandatory pre-implementation
  items only** — a structured summary, not a second ledger.
- **Every checklist item you leave open (`[ ]`) because of a real gap MUST have a
  corresponding finding in the JSON.** A checklist item cannot fail without a matching
  finding; the JSON and the checklist can never disagree. If the gate is FAIL, the JSON
  is `changes_required` (or `unable_to_review`); if the gate is PASS with no other
  findings, the JSON is `approve`.

Emit findings as a JSON file per `docs/findings-contract.md`, validated against the
schema. First line of your chat response:
- `Ready`     — verdict `approve` (and the gate is PASS)
- `Not Ready` — verdict `changes_required` / `unable_to_review`, or any gate item open
  for a real gap

After the verdict, in chat: state the `plan-review.md` gate result (PASS, or FAIL with
open item numbers) and a brief `Artifacts reviewed` list. Follow the contract per
finding: honest `verification` with real `evidence`, correct `class`, no inflation.