Create a technical plan for this Spec Kit feature.

Instructions:
- Read the spec, the feature brief, and `.specify/memory/constitution.md` before writing.
- Do not assume missing information. Do not implement code.
- Keep the plan practical and scoped to the feature.

Write or update:
- `plan.md` in the feature directory (`specs/###-name/`)
- Supporting artifacts by this heuristic: if the feature adds/changes the journal
  schema, git behavior, or an adapter contract, or has more than ~2 phases, produce
  `data-model.md` (journal events + tables + projections), `contracts/` (CLI surface,
  adapter interface, or event envelope as applicable), `research.md`, `quickstart.md`,
  and `checklists/plan-review.md`. Trivial features may skip these.

`checklists/plan-review.md` is a **pre-implementation gate** — read and verified before
any code is written. Scope its items to things checkable against the plan itself:
spec/plan scope alignment, architecture soundness, journal/data-model risks, contract
correctness, test strategy, constitution compliance. Do NOT include items only
confirmable after implementation (grep results, full suite passing) — those belong to
the conformance/PR review.

Include:
- architecture and data flow
- affected components
- risks and tradeoffs
- validation approach (CLI invocations, journal-state assertions, git-state assertions
  — Minna has no browser)

Add a constitution compliance note covering, as applicable to this feature:
- git ownership and the subprocess boundary (XIII) — confirm no agent gets git/state authority
- journal integrity (III) — every state mutation paired with a same-transaction event
- checkpoint safety (XIV) — gitignored capture, monotonic create-only refs, documented
  restore, tolerant force-add, scope-escape detection
- findings contract (XV) — reviews use it, reviewer != producer
- cost/telemetry (XVI) — no paid APIs; measure from outside; no uniform-telemetry assumption
- justification for any new dependency (constitution XII — new dependencies require justification)

Add this required section:

## Affected Areas
- files/components likely to be inspected
- files/components likely to be modified (note which scaffold files this supersedes,
  e.g. `src/core/state.ts`, `src/core/workflow.ts`)
- tests likely to be added or updated
- areas explicitly out of scope

Token/context discipline:
- Prefer precise affected areas over broad repo exploration.
- Do not list unrelated files to be exhaustive.
- If uncertain, mark an area "inspect only" rather than "modify".