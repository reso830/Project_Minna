Address review findings on a Spec Kit artifact (spec, plan, tasks, or code), as the PRODUCER.

Instructions:
- Read the review findings file(s) you are given, the artifact(s) they refer to, the feature
  brief, `.specify/memory/constitution.md`, `docs/findings-contract.md`, and
  `docs/findings-response.schema.json`.
- You are the PRODUCER responding to independent review. You do NOT close findings and you
  NEVER edit the reviewer's findings file. Only a reviewer may mark a finding
  `verified`/`superseded`; only the human may `waive`.

For EVERY finding in EACH review, do exactly one of:
- **addressed** — make the change in the artifact; record what you changed and where.
- **contested** — you believe the finding is wrong; leave the artifact unchanged and give
  reasoning. The reviewer/operator decides.
- **deferred** — ONLY if the operator explicitly marked it Accepted/out-of-scope; cite that.

Write ONE response file per review you are responding to, at:
`specs/<feature>/reviews/r<n>-<lens>-response.json`  (e.g. `r1-arch-response.json`,
`r1-engr-response.json`), conforming to `docs/findings-response.schema.json`:
- `responds_to`: the review filename (e.g. `r1-arch-review.json`)
- `responses`: one entry per finding id, with `action` (`addressed`/`contested`/`deferred`),
  and `change`+`files` (for addressed) or `reasoning` (for contested/deferred).
- Every finding id in the review must appear exactly once. Do not invent ids.

Rules:
- **Fix the class, not just the instance.** When you address a finding, search the whole
  package and codebase for every other occurrence of the same underlying problem — other
  code paths with the same issue (e.g. an MCP path mirroring a CLI path), stale references
  in diagrams / comments / help text / examples left behind by your own edit, and related
  docs. Fix all of them in the same pass. A change that resolves the exact line named but
  leaves the same problem one file over, or leaves a now-stale reference elsewhere, is
  INCOMPLETE and will just return as a finding next round. Name, in your response, the
  other occurrences you found and fixed.
- Do NOT edit any reviewer findings file. Your writes are: the artifact changes, and your
  response JSON file(s).
- Do not close/delete/downgrade findings — disposition is the reviewer's on re-review.
- No opportunistic rewrites beyond what the findings + operator decisions require — a
  re-review must be able to trust the diff maps to the findings. (This does not conflict
  with "fix the class": extending a fix to every occurrence of the SAME problem a finding
  names is required completeness; changing UNRELATED things a finding does not name is the
  opportunistic rewrite to avoid. Same problem elsewhere → fix it. Different problem you
  happened to notice → leave it, or raise it as a note, don't silently change it.)
- Honor operator decisions handed to you verbatim; they override your own judgement and any
  conflicting finding (cite them in the relevant `reasoning`/`change`).
- A fix must not violate the constitution elsewhere (no reintroducing M2 domain fields,
  file-backed state, agent git authority, or a bypass path while fixing something else).
- If a finding is unclear or two conflict, stop and ask one clarification (fail closed).

Also give a short chat summary: per review, counts of addressed/contested/deferred, files
changed, and any new question surfaced.