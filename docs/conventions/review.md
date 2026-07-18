# Review artifact conventions

Canonical location: `docs/conventions/reviews.md`. Single source for review-file naming
across all features (do not copy into per-feature `reviews/` folders). The phase prompts in
`scripts/prompts/minna-*.md` embed their own output paths; this doc documents the shared
scheme they follow — if a path here and a prompt ever disagree, the prompt wins and this doc
is updated to match.

All review correspondence for a feature lives in `specs/<feature>/reviews/`, named
`r<round>-<lens>[-<kind>].<ext>`. The **findings JSON is the canonical review record**;
everything else is a view or a response referencing it by finding `id`.

| File | Producer | Format | Purpose |
|---|---|---|---|
| `r<n>-arch-review.json` | architect-lens reviewer | findings contract | design soundness / spec robustness |
| `r<n>-engr-review.json` | engineer-lens reviewer | findings contract | buildability / contract-to-code / real files |
| `r<n>-arch-response.json` | producer | response schema | producer's per-finding response to the arch review |
| `r<n>-engr-response.json` | producer | response schema | producer's per-finding response to the engr review |
| `r<n>-phase-<pp>-review.json` | conformance reviewer | findings contract | per-phase implementation review (implement half) |
| `r<n>-pr-review.json` | PR reviewer | findings contract | final gate (also posted to the GitHub PR as a view) |

Separately, `../checklists/plan-review.md` is the engineer gate's **PASS/FAIL view** over
mandatory pre-implementation items — every open item has a matching finding in the engr JSON.

Rules:
- **Lens names the review perspective, never the agent.** Agents swap on quota walls;
  perspectives (`arch`, `engr`, `phase-NN`, `pr`) are stable. A file is never named for Claude/Codex/Agy.
- **The producer never edits a reviewer's findings file.** It responds in its own
  `*-response.json`, referencing findings by `id`.
- **Findings JSON is canonical.** The checklist and any GitHub PR comment are views over it
  and must not contradict it.
- Round increments on each review→address→re-review lap (`r1`, `r2`, …). Round count is a
  health signal: many rounds ⇒ the spec or the producer needs attention.