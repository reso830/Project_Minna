Create phased implementation tasks for this Spec Kit feature.

Instructions:
- Read the spec and plan before writing tasks.
- Do not assume missing information. Do not implement code.
- Keep tasks small, ordered, and easy to verify.

Write or update:
- `tasks.md` in the feature directory (`specs/###-name/`)

Open `tasks.md` with a conventions header:
- status legend: `[x]` done · `[ ]` pending · `[~]` skipped
- the `[P]` marker for tasks that can run in parallel (different files, no shared edits)
- the phase-dependency line (e.g. `01 -> 02 -> 03`)
- the project commands (e.g. `npm run test`, `npx tsc --noEmit`)
- a **phase summary table** immediately after the header: one row per phase with phase
  number, short focus/name, task ID range, and the user stories it covers (or `—` for
  non-story phases like Release Prep).

Requirements:
- Group work by phase (`Phase 01`, `Phase 02`, …).
- Order phases **additively** so the test suite passes after every phase, not just at
  the end — nothing left broken at a phase boundary.
- Each task must include:
  - target files/components, with explicit paths
  - expected behavior
  - constraints
  - validation/test location
  - out-of-scope files/components when applicable
- For any journal-writing logic, include explicit test tasks asserting the
  **same-transaction** invariant (state mutation and its event are written together; a
  failure rolls back both) and that events are append-only.
- For any git/checkpoint logic, include explicit test tasks for: gitignored-path
  capture, non-invasiveness (HEAD/branch/index unchanged), monotonic non-overwriting
  refs, tolerant force-add of missing paths, loud failure (no silent null), and temp
  cleanup.
- For any agent-run logic, include test tasks for: pre/post-run checkpoints, run events
  recorded, usage-limit detection, and scope-escape detection + block.
- The final phase of every feature MUST be **Release Prep**:
  - `CHANGELOG.md` entry
  - tick the feature's row in `docs/feature_roadmap.md`
  - `README.md` / operator-doc updates for any new CLI surface
  - version bump in `package.json` (+ lockfile) and any in-CLI version display
  - docs sanity check (constitution VII, VIII)
  There is no Browser Smoke Test — Minna has no browser. The equivalent is a
  **Workflow Smoke Test** phase (constitution IX) when the feature adds operator
  workflows: a short scripted CLI walk (e.g. checkpoint→restore, run→inspect journal,
  review→validate) run against the to-be-merged state.

Guidelines:
- Prefer specific file paths over generic descriptions.
- Keep each task scoped to a minimal set of files; avoid whole-repo scans.
- Align target files with the plan's `Affected Areas`.
- Make review/validation tasks explicit enough that another agent can execute them without guessing.