# Project Minna Constitution

## Core Principles

### I. Human Authority & Decision-Making

Humans decide, Minna coordinates.

Humans are solely responsible for:

* Product direction
* Architectural decisions
* Prioritization
* Acceptance decisions
* Release decisions

Minna may coordinate, summarize, recommend, and assist, but must not become an autonomous decision-maker.

Recommendations must always remain distinguishable from decisions.

---

### II. Deterministic Orchestration

Minna is a deterministic orchestration platform, not an autonomous agent framework.

Workflows must remain:

* Deterministic
* Auditable
* Explainable
* Observable

Workflow transitions must be explicit.

State changes must be traceable.

Automation must never become a black box.

**Authoritative workflow state is never derived from an agent's freeform text.**
Gate progression is driven by validated artifacts and policy, never by
string-matching or interpreting model prose. (This is the documented root cause of
the retired `ai-flow.ps1` orchestrator, which derived gate state from the first line
of LLM output.)

---

### III. State Is The Source Of Truth

Minna is the authoritative source of truth for:

* Projects
* Features (work items)
* Workflow state
* Decisions

External systems may provide signals and metadata but must not become the authoritative source of orchestration state.

**Mechanism (Amendment 1.2.0):** authoritative state is held as an **append-only
event journal** with a **same-transaction** current-state projection.

* Events are never updated or deleted.
* Every state mutation and its corresponding event are written in the **same
  database transaction**. Mutating a current-state table without emitting the paired
  event in the same transaction is a constitutional violation.
* Current-state tables are a **projection** of the event log, re-derivable from it.
* Workflow state is not reconstructed from external systems when authoritative state
  already exists within Minna. Anything with an external source of truth (git/GitHub
  merge state, CI results) is treated as a cache to be re-derived live, never as a
  gating fact stored locally.

---

### IV. Thin Interfaces & Core Logic

Business logic belongs in core services.

Interfaces exist to consume orchestration services.

CLI, MCP, web interfaces, and future conversational interfaces must remain thin wrappers around shared business logic.

Preferred architecture:

```text
Interfaces
    ↓
Core Services
    ↓
State Layer (event journal + projections)
```

Business logic must not be duplicated across interfaces.

---

### V. MCP-Ready, Not Required

Minna should support future MCP-based integrations without requiring MCP for basic operation.

The platform must remain fully functional through local execution and local configuration.

No core capability should depend exclusively on MCP.

**Corollary (Amendment 1.2.0):** in the current design agents are **subprocesses**,
not MCP participants. MCP is deferred precisely because it would return
state-mutating authority to agents that Principle XIII removes. MCP arrives as one
adapter later, never as the mutation boundary.

---

### VI. Local-First, Inspectable State

Prefer local-first solutions whenever practical.

State must remain **inspectable, recoverable, and portable**.

**Amendment 1.2.0 — clarified mechanism.** The goal of this principle is
inspectability and recoverability, not a particular file format. Authoritative state
is a **local SQLite event journal** (`.minna/minna.db`). Human-readability is
provided by tooling, not by the storage format:

* `minna log` renders the human-readable timeline.
* `minna verify` re-derives state from the event log and diffs it against the
  projection; drift is a defect.
* On work-item completion, a human-readable timeline is **exported into the feature
  directory and committed**, so history is never trapped in a binary.

Hand-editable flat-file state is explicitly rejected: the moment state is
hand-editable it ceases to be authoritative. SQLite-plus-export serves inspectability
and recoverability better than a raw file while preserving this principle's intent.

Minimize infrastructure. Avoid external systems before demonstrated need.
Single-operator workflows are optimized before multi-user workflows are considered.

---

### VII. Documentation Discipline

Documentation is part of the deliverable.

A feature is not complete until all impacted documentation has been updated.

Documentation may include:

* README
* CHANGELOG
* Roadmap
* Feature Briefs
* Architecture Documentation
* Operator Guides

Documentation must accurately reflect actual system behavior.

---

### VIII. Mandatory Release Preparation

Implementation completion alone does not constitute feature completion.

Every feature must complete release preparation before acceptance:

1. Acceptance criteria verification
2. Documentation review and updates
3. Release note preparation
4. CHANGELOG updates
5. Validation of impacted operator workflows

A feature is not considered complete until release preparation has been completed.

---

### IX. Workflow Smoke Testing

Every feature must define and execute smoke tests appropriate to its scope.

Smoke tests should focus on critical operator workflows and regression prevention.

For Minna's actual surface, examples include:

* Creating a checkpoint and restoring from it (including a gitignored path)
* Running an agent through the run wrapper and finding the recorded run events
* A review producing a schema-valid findings file, and an invalid one being blocked
* `minna verify` reporting no drift after a sequence of operations
* Journal export producing a committed, human-readable timeline

Smoke tests should remain lightweight, repeatable, and practical to execute. Minna
has no browser surface; tests are CLI invocations, journal-state assertions, and
git-state assertions.

---

### X. Context Preservation

Project knowledge should survive:

* Feature completion
* Agent handoffs
* Project pauses
* Contributor changes

Decisions, workflow history, project context, and operational knowledge should be preserved whenever practical. The event journal is the primary vehicle for this — decisions and approvals are events, not a separate subsystem.

Minna should reduce context loss rather than contribute to it.

---

### XI. Dogfooding (Minna Builds Minna)

Minna should preferentially use its own capabilities whenever practical.

The project progressively manages its own development lifecycle through Minna.

Temporary exceptions are acceptable when functionality does not yet exist, but should be revisited as the platform matures. (M1 is necessarily built by hand — the orchestrator cannot orchestrate its own construction. From M2 onward, Minna's development is expected to run through Minna.)

If Minna cannot successfully orchestrate its own evolution, it is not ready to orchestrate other projects.

---

### XII. Simplicity Before Scale

Build for current requirements rather than hypothetical future requirements.

Prefer:

* Clarity over cleverness
* Maintainability over abstraction
* Practicality over speculation

Premature optimization, speculative architecture, and "just-in-case" complexity should be avoided. Prefer deleting architecture over adding it. Refactor for scale only when evidence demonstrates the need.

---

### XIII. Minna Owns Git; Agents Are Subprocesses  *(new — Amendment 1.2.0)*

**Minna owns all git operations.** Agents edit files in a worktree and nothing else.
No agent checks out, switches, rebases, stashes, merges, resets, or pushes. Granting
an agent a git-mutating capability is a `CRITICAL` violation.

**Agents have no state-mutating authority.** An agent is a subprocess: Minna injects
context, the agent edits files and/or writes one declared output artifact, Minna
reads the filesystem and decides everything. Workflow state, findings resolution,
gate transitions, and ownership are Minna's alone. An agent cannot be given a tool
that transitions state.

**No bypass flags.** There is no `--yes`, no auto-approve path that skips a required
human gate. If a bypass exists it becomes the default path.

**Fail closed.** On any ambiguity — missing approval, invalid artifact, dirty or
shared workspace, unparseable review, a check that could not run — Minna blocks and
escalates. It never guesses forward.

---

### XIV. Git Safety Is Recoverable By Construction  *(new — Amendment 1.2.0)*

Motivated by real lost work: an agent's uncommitted worktree edits were destroyed by
an external branch switch.

* **Checkpoints before and after every agent run** and before any destructive
  operation. A checkpoint is a dangling commit — branch/HEAD/index/worktree untouched,
  invisible to agents.
* **Checkpoints capture everything an agent may produce**: staged, unstaged,
  untracked, and every configured gitignored path (agent work ledgers live in
  gitignored directories). Force-adding a configured path that does not exist must be
  tolerated, not fatal.
* **Checkpoint refs are monotonic and create-only** — a bad sequence must never
  overwrite an existing checkpoint.
* **Restore semantics are documented**, not silently lossy (single-tree restore
  returns content unstaged; acceptable because Minna owns git and agents never stage).
* **Scope escape is detected and blocks**: snapshot refs and hash git config + hooks
  before/after each run; unexpected change emits an event and blocks. Detection, not
  prevention, is the v1 bar — but detection is mandatory. Adapters declare their
  agent's legitimate scratch space so private-tree writes are distinguished from
  repo escapes.

---

### XV. Reviews & The Findings Contract  *(new — Amendment 1.2.0)*

* **Reviewer ≠ producer.** No agent reviews its own output as an independent gate.
* **Reviews use the versioned JSON findings contract** (`docs/findings-contract.md`),
  written to a declared file and validated against its schema. Invalid output gets one
  repair attempt with the validation errors echoed back, then blocks. Reviews are
  never parsed from freeform prose.
* **`verification: checked` is an honesty signal, not a guarantee**, and is not
  mechanically enforceable (proven in the M0 spike). `asserted` findings surface to
  the operator but never auto-route back to the producer. The defenses against a
  confidently-wrong review are the second reviewer and the human.
* **Severity does not gate logic** until calibrated against a fixture containing
  genuine non-blocking issues (M0: 62/65 findings were `blocker`). Until then severity
  is display metadata.
* **Independent reviewers' findings are not deduped.** Disagreement is signal.
* **Correlated hallucination is a known residual risk**: two vendors can share a false
  belief about tool semantics, defeating multi-reviewer independence (observed in M0).
  No automated defense exists; sandboxed command execution and the human are the
  mitigations.
* **Finding lifecycle:** producer may only mark `addressed`; only a reviewer may mark
  `verified`/`superseded`; only the human may `waive`. On re-review every prior open
  finding is explicitly dispositioned — omission is not closure.

---

### XVI. Cost & Quota Are First-Class  *(new — Amendment 1.2.0)*

* **Token economy is a design constraint, not an afterthought.** The operator runs
  lowest-tier subscriptions with hard usage walls and no API credits. Designs that
  assume paid APIs, metered credits, or hosted services are out of bounds unless the
  operator explicitly asks.
* **Quota continuity via secondary ownership.** Every work item has a primary and a
  secondary owner; the secondary continues work when the primary hits a usage wall.
  Fallback is reactive (detect a rate-limit error, reassign), never predictive.
* **Minna measures from the outside.** Duration, tokens where the adapter reports
  them, exit status — all observed by Minna wrapping the subprocess. An agent's
  self-reported telemetry is an asserted value and is not trusted. Telemetry is not
  uniform across adapters and no design may assume it is.

---

## Development Workflow

### Feature Lifecycle — one generic work-item loop

All development follows the Spec Kit lifecycle, expressed as **one generic work-item
loop** parameterized by artifact type — not a bespoke per-phase state machine
(Principle II, XII):

```text
produce artifact → automated check → independent review → human gate → next
```

Applied to the SDD phases:

| Work-item type      | Producer      | Automated check          | Review          | Human gate         |
|---------------------|---------------|--------------------------|-----------------|--------------------|
| Spec / Plan / Tasks | agent         | artifact linkage/revision| 2 reviewers     | clarify + approve  |
| Design (UI work)    | Claude Design | —                        | operator eye    | approve            |
| Implement (phase)   | agent         | test command             | 1 conformance   | auto-advance clean |
| PR / feature review | —             | full test suite          | 2 non-implementers | approve → merge |

The **automated check runs before review** (cheaper gate first). **Approvals are
revision-bound** — they reference the exact artifact revision, don't carry forward
after change, and never authorize a standing-rule override. **Scope creep routes to a
new work item by default.** **Gate rigor scales with declared risk** (a `low`-risk
item may run checks-only).

### Quality Gates

Changes must be supported by evidence.

Features require specifications. Implementations require validation. Acceptance requires verification.

No feature is complete without demonstrating that the intended behavior works as expected.

---

## Governance

This Constitution is the supreme governance document for Project Minna.

It supersedes local conventions, implementation preferences, and workflow habits.

All specifications, plans, tasks, implementations, and reviews must comply with this Constitution. A conflict with the Constitution is a `CRITICAL` review finding.

Amendments should be infrequent, deliberate, and recorded as decision events in the journal.

### Provisional articles (not yet fully settled)

The following are law but flagged for revisit as evidence accrues:

* **XV severity-gating** — lift the "severity is display-only" restriction once a
  fixture with genuine nits shows agents differentiate severity reliably.
* **`class: out_of_scope` handling** — unexercised in M0; validate on first real use.
* **Findings repair-attempt rule** — never triggered in M0 (15/15 valid); retained,
  watched.

---

**Version:** 1.2.0
**Ratified:** 2026-06-17
**Last Amended:** 2026-07-16

### Amendment log

* **1.2.0 (2026-07-16)** — Grafted the M0 findings-contract spike results into the
  constitution. Amended II (no state from freeform text), III (event-journal
  mechanism), V (subprocess corollary), VI (SQLite-plus-export replaces file-backed),
  IX (Minna-appropriate smoke examples), and the Development Workflow (generic
  work-item loop replaces hardcoded seven-phase machine). Added XIII (git authority /
  subprocess model / no-bypass / fail-closed), XIV (checkpoint git safety), XV
  (findings contract + reviewer independence), XVI (cost/quota first-class).
* **1.1.0 (2026-06-17)** — Initial ratified constitution (pre-M0).