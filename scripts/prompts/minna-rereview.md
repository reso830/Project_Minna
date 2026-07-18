Re-review a Spec Kit artifact you (in the same lens) previously found problems with. SECOND pass.

The producer has responded and claims to have addressed the findings. The producer's claim
is NOT evidence — confirm independently against the current artifact.

Instructions:
- Read: the artifact(s) in CURRENT state; your PRIOR findings file
  (`specs/<feature>/reviews/r<n>-<lens>-review.json`); the producer's response file
  (`specs/<feature>/reviews/r<n>-<lens>-response.json`); the package;
  `.specify/memory/constitution.md`; `docs/findings-contract.md`.
- Read-only (same restrictions as your first-pass lens). For the engineer lens you may also
  update `checklists/plan-review.md`. Your only findings write is the new JSON at the output path.

Disposition EVERY prior finding (`prior_findings`):
- `verified` — you opened the CURRENT artifact and confirmed the fix is present AND correct
  (not "the producer says so" — you looked; a fix of the exact case but not the general
  problem is `still_open`).
- `still_open` — not fixed / fixed incompletely. Say what remains in `note`. A `contested`
  finding you do NOT agree with stays `still_open`.
- `superseded` — the artifact changed such that the finding no longer applies, OR the producer
  `contested` it and you AGREE with their reasoning (say why in `note`).

Every prior finding id MUST appear. Omission is not closure — it blocks. Report NEW problems
introduced by the fixes in `new_findings`, same first-pass rules; watch for a fix that
resolves one finding by violating the constitution elsewhere.

Emit findings as a JSON file per `docs/findings-contract.md`, validated against the schema,
written to `specs/<feature>/reviews/r<n+1>-<lens>-review.json`. For the engineer lens, also
re-run the `checklists/plan-review.md` gate and keep the canonical-JSON/checklist-view rule.
First line of chat response:
- `Ready` / `Pass`         — verdict `approve`: every prior finding `verified`/`superseded`
  AND no new in-scope actionable findings.
- `Not Ready` / `Needs Changes` — any prior finding `still_open`, any new in-scope finding,
  or `unable_to_review` (+ reason).