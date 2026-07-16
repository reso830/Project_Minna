# Minna Roadmap

> Canonical product roadmap for Project Minna.
> **Realigned 2026-07-16** to the M0 findings-contract spike results and Constitution
> v1.2.0. The prior roadmap (six pre-M0 features under a single "Workflow Foundations"
> release) is superseded; its feature briefs are archived under
> `docs/features/_pre-m0/`. See the amendment note at the bottom.

---

# Vision

Minna is a **local-first, deterministic orchestrator for Spec-Driven Development**
that coordinates multiple coding agents while protecting repository state.

It exists to end the operator's role as a **human API** — manually relaying context
between agents, triggering each phase, tracking state, and guarding git — while
humans keep authority over direction, prioritization, and approval.

Core philosophy (see Constitution):

* Humans decide, Minna coordinates.
* Deterministic orchestration; authoritative state never derived from agent prose.
* Minna owns git; agents are subprocesses that edit files.
* Nothing is lost — work is checkpointed and recoverable by construction.
* Every gate is evidence-driven and independently reviewed.

This is a **personal learning project**, not a commercial product. Success is measured
in knowledge, recoverability, and whether Minna can eventually build Minna — not in
adoption or revenue.

---

# Why the roadmap changed

The original roadmap sequenced project-registry → feature-registry → workflow-engine →
state-management → decision-log → operator-cli as v1.0.0, then placed agents, reviews,
and governance in v2.0.0 — and never scheduled git safety at all.

The M0 spike and the resulting constitution inverted this:

* **The founding trauma is lost git work.** The safety net (checkpoints) must come
  first, not after five tracking features.
* **The event journal absorbs four of the six original features.** State-management,
  decision-log, workflow-state, and feature-status are all "write an event, project a
  table." They are not separate subsystems.
* **File-backed mutable state is rejected** (Constitution III, VI). The scaffold's
  `src/core/state.ts` is superseded by a SQLite event journal.
* **The hardcoded seven-phase workflow is rejected** (Constitution, Development
  Workflow). `workflows/speckit-feature.yaml` is superseded by one generic work-item
  loop.

The result: v1.0.0 is now the safety-net-and-loop that makes Minna *Minna*, and the
tracking concepts survive as tables on the journal spine rather than as standalone
features preceding it.

---

# Scaffold disposition

The merged scaffold (`codex/minna-orchestrator-scaffold`, PR #1) is partly salvageable.

| Scaffold artifact | Disposition |
|---|---|
| `src/cli.ts` | **Salvage** structure; commands grow per-feature. |
| `src/adapters/claude.ts`, `codex.ts` | **Salvage names**; currently stubs — real subprocess logic built in M1/003. |
| `src/adapters/github.ts` | **Defer** — GitHub awareness is v2.0.0. |
| `src/core/types.ts` | **Salvage/evolve.** |
| `src/core/state.ts` | **Supersede** → SQLite event journal (M1/001). File-backed JSON violates Constitution III/VI. |
| `src/core/workflow.ts`, `workflows/speckit-feature.yaml` | **Supersede** → generic work-item loop (M2). Hardcoded phase machine violates Development Workflow. |
| `src/server/mcp.ts`, `tools.ts` | **Park** — MCP is deferred (Constitution V); agents are subprocesses, not MCP participants, until v4.0.0. |
| `policies.yaml` | **Review** — repurpose as the config for budgets/roles/`includeIgnored`, not a gate-by-string engine. |
| `state/` dir | **Retire** in favor of `.minna/`. |

Superseding these is *feature work*, done on feature branches through the SDD loop and
reviewed against the constitution — not deleted in a governance commit.

---

# Product Direction

| Version | Theme | Status |
|---|---|---|
| 1.0.0 | Safety Net & The Loop | Planned |
| 2.0.0 | The Full SDD Pipeline | Planned |
| 3.0.0 | Integration & GitHub Awareness | Planned |
| 4.0.0 | Context & Knowledge | Planned |
| 5.0.0 | Conversational Minna | Planned |
| 6.0.0 | Self-Hosting Development Platform | Planned |

The milestone labels **M0–M4** used during design map onto releases as noted.

---

# 1.0.0 — Safety Net & The Loop  (design milestones M1 + M2)

> Never lose agent work again, then orchestrate a single feature end to end.

## Goals

* Checkpoint and recover any agent work by construction.
* Establish the append-only event journal as the source of truth.
* Run agents as subprocesses through a uniform adapter, with Minna owning git.
* Orchestrate one code feature through implement → test → review → approve without
  the operator relaying context by hand.

## Features

**M1 — Safety Net** (each is independently useful; if work stops here, the worst
failure mode is already gone):

* [ ] 001-event-journal — SQLite append-only events + same-transaction projections;
  `minna log`, `minna verify`, `minna export`. *Supersedes `state.ts`.*
* [ ] 002-git-checkpoints — dangling-commit checkpoints capturing untracked +
  configured-gitignored work; monotonic create-only refs; `minna checkpoint`,
  `checkpoints`, `restore`. Force-add tolerates missing paths.
* [ ] 003-agent-run-wrapper — adapter interface + Claude/Codex/Antigravity;
  `minna run <agent>` wraps checkpoint → spawn → capture → checkpoint → record;
  reactive usage-limit fallback; scope-escape detection. Minna owns git.

**M2 — The Loop** (generic work-item engine; code phase enabled first):

* [ ] 004-work-item-engine — generic loop (produce → check → review → gate → next),
  one item active, primary/secondary owners, risk levels, cycle budgets.
  *Supersedes `workflow.ts` and the phase YAML.*
* [ ] 005-check-gate — run the item's automated check (tests for code) before review;
  route failures back with output; separate test-repair budget.
* [ ] 006-review-gate — findings contract for real: `findings` table, JSON-file
  validation, one repair attempt then BLOCK; finding lifecycle; reviewer ≠ producer.
* [ ] 007-approval-and-merge — revision-bound approvals; deployment-parity prompt on
  infra diffs; `--no-ff` merge; **no `--yes` flag**.

*Project & feature identity* (the salvageable parts of the old 001/002) live as small
tables written via journal events inside 001/004 — not as standalone features.

---

# 2.0.0 — The Full SDD Pipeline  (design milestone M3)

> Turn on the spec half; the whole SDD loop with no human relay.

## Goals

* Enable spec/plan/tasks as work-item types on the same generic loop.
* Bring design handoffs in as first-class tracked artifacts.
* Survive crashes and quota walls unattended.

## Features

* [ ] 008-spec-plan-tasks-types — register the artifact types; linkage/revision checks;
  two-reviewer spec gate; clarify gate.
* [ ] 009-design-artifact-type — Claude Design handoff packages tracked (not invoked)
  and injected into implementer context; visual-fidelity gate.
* [ ] 010-resume-and-reconciliation — write-intent-before-action; `minna resume`
  reconciliation table; kill-tested.
* [ ] 011-quota-continuity — secondary-owner reassignment on usage-limit detection,
  hardened across the full pipeline.

---

# 3.0.0 — Integration & GitHub Awareness

> Coordinate with the world outside the worktree.

## Goals

* Treat GitHub/CI state as a re-derived cache, never a gating local fact.
* Formalize PR review as the two-non-implementer gate against real CI.

## Features

* [ ] 012-github-awareness — read PR/CI/mergeability state live (`src/adapters/github.ts`
  grows up here).
* [ ] 013-pr-review-gate — full-feature antagonistic review, both non-implementers,
  against the to-be-merged state.
* [ ] 014-policy-surface — budgets, roles, risk tiers, `includeIgnored` as reviewed
  config (repurposed `policies.yaml`).

---

# 4.0.0 — Context & Knowledge

> Preserve and leverage project knowledge; open the integration boundary.

## Goals

* Reduce context loss across handoffs and pauses.
* Introduce MCP as an adapter, once agents genuinely need to be long-lived
  participants rather than one-shot subprocesses.

## Features

* [ ] 015-project-memory — durable, journal-backed history and retrieval.
* [ ] 016-context-builder — deterministic context assembly per work-item type.
* [ ] 017-architecture-decision-records — ADRs as a journal-backed artifact type.
* [ ] 018-mcp-server — MCP as one integration adapter (the parked `src/server/`
  revisited under Constitution V).

---

# 5.0.0 — Conversational Minna

> Make orchestration accessible through conversation, and give Minna a face.

## Goals

* Reduce operational friction; provide status and recommendations.
* Establish Minna's persona — the bridge to the ComfyUI track.

## Features

* [ ] 019-status-briefings — journal-derived summaries of what's happening / blocked / next.
* [ ] 020-recommendation-engine — advisory routing and next-step suggestions (advisory only; Constitution I).
* [ ] 021-conversational-interface — thin conversational wrapper over core services.
* [ ] 022-avatar-and-persona — Minna's ComfyUI-designed character reflecting current
  activity. The point where the coding and image-generation learning tracks meet.

---

# 6.0.0 — Self-Hosting Development Platform

> Use Minna to build and manage future projects.

## Goals

* Standardize project/feature bootstrap.
* Fully dogfood: Minna orchestrates Minna and the next named projects (Monica, Eila, Azusa…).

## Features

* [ ] 023-project-bootstrap
* [ ] 024-feature-brief-generator
* [ ] 025-speckit-bootstrap
* [ ] 026-self-orchestration

---

# Guiding Principles

(See the Constitution for the authoritative statements; summarized here.)

* **Humans decide, Minna coordinates** — track, summarize, recommend, coordinate; never own priorities, approvals, architecture, or direction.
* **Deterministic over autonomous** — validated artifacts and policy drive gates, never agent prose.
* **Minna owns git; agents are subprocesses** — the boundary that makes recovery and governance possible.
* **Nothing is lost** — checkpoint before/after every run; the journal is append-only.
* **Context persists** — through completion, handoffs, pauses, and contributor changes, via the journal.
* **Dogfood everything** — if Minna cannot orchestrate Minna, it is not ready for other projects.

---

# Notes

* This roadmap is directional, not contractual. Ordering may evolve as implementation
  teaches us more — exactly as M0 rewrote it once already.
* Each 1.0.0 feature is sized to be independently useful, so a pause after any of them
  still leaves a working, valuable tool.
* Smaller operational tasks may exist outside this roadmap.

---

## Amendment note (2026-07-16)

Superseded the pre-M0 roadmap. The original v1.0.0 (001-project-registry through
006-operator-cli) is archived under `docs/features/_pre-m0/`. Its durable concepts
were absorbed: project/feature identity became journal-backed tables; workflow state
and decision log became journal events; the operator CLI became per-feature commands;
state-management and workflow-engine were rejected outright in favor of the event
journal and the generic work-item loop (Constitution III, VI, and Development
Workflow). The current v1.0.0 leads with the git safety net and the orchestration loop
— the features that motivated the project and were validated in the M0 spike.