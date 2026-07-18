# Minna Findings Contract v1

> Canonical review-output format for the whole project. Schema:
> `docs/findings-contract.schema.json` (validated with ajv). Promoted from the M0
> spike's `review-schema.json` after 15 first-pass + 3 re-review runs across Claude
> Code, Codex, and Antigravity (100% schema-valid). This is law — see Constitution XV.

Every review — spec review, plan review, per-phase conformance check, PR review —
emits this format to a declared file. Review prompts reference this document by name
rather than restating it.

---

## Rules (constitutional — Constitution XV)

1. **File, not prose.** Output is a JSON file written to a declared path, never parsed
   from stdout or freeform text. Invalid output -> **one** repair attempt with the
   validation errors echoed back -> then **BLOCK**. Raw output and parsed artifact are
   both preserved, with the schema version recorded.
2. **Reviewer != producer.** No agent reviews its own output as an independent gate.
3. **Every prior open finding is dispositioned on re-review.** Omission is not closure.
4. **`evidence` is mandatory** and contains what was actually observed — the code read,
   the command run and its output, or the violated requirement ID. Not a restatement of
   the summary.
5. **`verification: checked` is an honesty signal, not a guarantee**, and is not
   mechanically enforceable (proven in M0 — verbatim-evidence validation produces mostly
   false positives and still misses fabricated claims). `asserted` findings are shown to
   the operator but never auto-routed back to the producer. The real defenses against a
   confidently-wrong review are the second reviewer and the human.
6. **Severity does not gate logic yet** (Constitution XV, provisional). Emit it honestly;
   do not depend on it. (M0: 62/65 findings were `blocker`.)
7. **Independent reviewers' findings are not deduped.** Disagreement is signal.
8. Strict on structure and enums; lenient on hints (store `line`, never gate on it).
9. **The findings JSON is the single canonical review record.** Where a review step also
   maintains a checklist (e.g. `checklists/plan-review.md` for the requirements gate), the
   checklist is a PASS/FAIL **view** over its mandatory items, not a second ledger — every
   failed/open checklist item must have a corresponding finding in the JSON, so the two
   can never disagree. No review produces findings-shaped content in any format other than
   this contract.

## Verdicts

- `approve` — no blocking or in-scope major findings remain.
- `changes_required` — at least one in-scope actionable finding.
- `unable_to_review` — the reviewer could not do the job (missing artifact, unreadable
  diff, broken repo). A legitimate, respected outcome; `unable_reason` is **required**
  for this verdict and **forbidden** for the others (enforced by the schema).

## Prior-finding dispositions (re-review only)

- `verified` — the reviewer opened the current artifact and confirmed the fix is present
  and correct. **The producer's claim is not evidence** — a partial fix is `still_open`.
- `still_open` — not fixed, or fixed incompletely.
- `superseded` — the artifact changed such that the finding no longer applies.

## New-finding fields

| Field | Values / rule |
|---|---|
| `severity` | `blocker` \| `major` \| `minor` \| `nit` — do not inflate; does not gate yet |
| `class` | `in_scope` \| `out_of_scope` \| `non_actionable` — `out_of_scope` spins off a new backlog item rather than routing back to the producer |
| `verification` | `checked` \| `asserted` — honest; `asserted` never auto-routes |
| `file`, `line` | hints, never gating |
| `summary` | one sentence: what is wrong |
| `evidence` | what was actually observed (code / command output / requirement ID) |
| `recommendation` | concrete: what to do |

## Finding lifecycle (who may set what — Constitution XV)

- **Producer** may only mark a finding `addressed`.
- **Reviewer** is the only path to `verified` / `superseded`.
- **Human** is the only path to `waived`.

**The producer never writes in the reviewer's findings file.** The producer responds in
a separate response file that references findings by `id` (see below). This preserves the
maker/checker boundary: producer files and reviewer files are distinct artifacts that
reference each other, never the same file edited by both.

## Producer response (separate file, schema: `findings-response.schema.json`)

After a review, the producer responds in `reviews/r<n>-<lens>-response.json` — one per
review it is responding to (`arch`, `engr`). It references the reviewer's findings by
`id`; it does NOT edit the reviewer's file. Shape:

```json
{
  "schema_version": 1,
  "responds_to": "r1-arch-review.json",
  "responses": [
    { "id": 1, "action": "addressed", "change": "status is now a required createFeature param; removed the 'specify' literal", "files": ["data-model.md", "contracts/api.md"] },
    { "id": 5, "action": "contested", "reasoning": "Actor union is intentional per Const. XVI; documented rather than changed" },
    { "id": 6, "action": "deferred", "reasoning": "operator marked Accepted / out-of-scope" }
  ]
}
```

- `action`: `addressed | contested | deferred`. The producer never uses `verified`,
  `superseded`, or `waived` — those are the reviewer's / human's on re-review.
- Every finding in the review being responded to must appear once in `responses`.
- On re-review, the reviewer reads: the current artifact, its own prior findings file, and
  this response file — then writes `r<n+1>-<lens>-review.json` dispositioning each prior
  finding (`verified`/`still_open`/`superseded`). A `contested` finding the reviewer
  agrees with becomes `superseded`; one it disagrees with stays `still_open`.

## Canonical JSON shape

```json
{
  "schema_version": 1,
  "verdict": "changes_required",
  "prior_findings": [
    { "id": 3, "disposition": "verified" },
    { "id": 1, "disposition": "still_open", "note": "only .agy/ force-added; .minna/scratch/ still dropped" }
  ],
  "new_findings": [
    {
      "severity": "blocker",
      "class": "in_scope",
      "verification": "checked",
      "file": "src/git/checkpoint.ts",
      "line": 33,
      "summary": "Hardcoded force-add of .agy/ crashes when the path is absent.",
      "evidence": "git add -Af .agy/ exits 128 (fatal: pathspec did not match) on a repo without .agy/.",
      "recommendation": "Iterate config.checkpoint.includeIgnored and skip nonexistent paths."
    }
  ]
}
```

`unable_to_review` example:

```json
{ "schema_version": 1, "verdict": "unable_to_review", "unable_reason": "spec.md not found in the package", "prior_findings": [], "new_findings": [] }
```

---

## Header mapping (for prompt authors)

The ported review prompts open with a one-line verdict header (Alice convention). Map
the contract verdict to the header:

| Contract verdict / findings | Spec/plan review header | Implementation/PR review header |
|---|---|---|
| any in-scope `blocker`/`major`/`minor` | `Not Ready` | `Needs Changes` |
| only `nit` / `non_actionable` / none | `Ready` | `Pass` |
| `unable_to_review` | `Not Ready` (+ reason) | `Needs Changes` (+ reason) |

Do not gate beyond this ready/not-ready split until Constitution XV's severity
provision is lifted.

---

## Known limits (carried from M0 — do not pretend these are solved)

- **`verification: checked` is unenforceable.** Rely on the second reviewer + human.
- **Correlated hallucination.** Two vendors can share a false belief about tool
  semantics (observed in M0: a wrong git ref-matching claim from two agents). Multi-
  reviewer independence does not defend against this; sandboxed command execution and
  the human do.
- **Severity is uncalibrated.** 62/65 M0 findings were `blocker`. Provisional until a
  fixture with genuine nits shows agents differentiate.
- **`class: out_of_scope` is unexercised.** Never fired in M0; validate on first real use.
- **The repair-attempt rule is unexercised.** 15/15 valid in M0; retained, watched.