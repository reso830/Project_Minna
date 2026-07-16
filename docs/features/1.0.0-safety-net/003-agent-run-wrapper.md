# 003-agent-run-wrapper

> Feature brief — input to `/specify`. Open questions are left for the clarify gate.

## Feature Overview

The agent run wrapper is Minna's boundary with coding agents. `minna run <agent>
<prompt>` wraps any agent invocation in: checkpoint → spawn the agent as a subprocess
→ capture its output → checkpoint → record the run in the journal. It also detects
usage-limit failures (for later fallback) and scope escapes (agents touching things
they shouldn't).

This completes M1: after this feature, the operator can run any agent through Minna and
trust that the work is checkpointed, recorded, and confined — the "never lose an hour"
guarantee, applied to live agent runs rather than manual snapshots.

The scaffold's `src/adapters/claude.ts` and `codex.ts` are **stubs** (placeholder
return strings); their names are salvaged, their bodies are written here. Antigravity
is added. `src/adapters/github.ts` is out of scope (v3).

## Why this exists

Agents individually produce work but destroy it, hang, crash, and hit usage walls.
Minna's answer is a uniform wrapper that makes every run recoverable (checkpoints
around it), attributable (journal events), confined (scope detection), and continuable
(usage-limit detection feeding later fallback) — while **Minna owns git and the agent
only edits files** (Const. XIII).

## Goals

* A small, uniform adapter interface over heterogeneous agent CLIs.
* Wrap every run in checkpoints and journal events.
* Detect and surface usage-limit failures and scope escapes.
* Prove the abstraction against three real agents before the M2 state machine relies on it.

## Constitutional constraints (must hold)

* **Minna owns git; the agent only edits files** (Const. XIII). The wrapper spawns the
  agent with a working directory; the agent runs no git that Minna depends on.
* **Agents are subprocesses with no state-mutating authority** (Const. XIII) — the
  agent's only outputs are file edits and (for reviews, later) a declared artifact;
  Minna reads the filesystem and decides.
* **Checkpoint before and after every run** (Const. XIV, via 002).
* **Scope escape is detected and blocks** (Const. XIV): before/after each run snapshot
  refs and hash git config + hooks; unexpected change → event + BLOCK. **Adapters
  declare their agent's legitimate scratch space** so private-tree writes (e.g.
  Antigravity's `brain/<uuid>/scratch/`, observed in M0) are distinguished from repo
  escapes.
* **Fail closed** on timeout/crash/ambiguous exit (Const. I) — record and block, don't
  guess.
* **Measure from the outside** (Const. XVI): duration, tokens where the adapter reports
  them, exit status — observed by Minna wrapping the subprocess; never trust an agent's
  self-reported telemetry. Telemetry is not uniform across adapters (M0: Claude reports
  cost/turns/duration, Codex tokens only, Antigravity none).
* **Reactive usage-limit fallback only** (Const. XVI): detect a rate-limit error →
  `run.failed(reason=usage_limited)`. (Actually *reassigning* to a secondary owner is
  M2/M3 work; this feature just detects and records.)

## In scope

* Adapter interface: `run(role, workdir, context, timeout) -> RunResult`
  (`RunResult`: exit status, transcript path, tokens?, raw output, diff stat).
* Three adapters — Claude Code headless, Codex exec, Antigravity — each declaring its
  scratch space and its (non-uniform) telemetry capability.
* `minna run <agent> <prompt>`: checkpoint → spawn → capture transcript → checkpoint →
  record `run.started` / `run.finished` / `run.failed` + diff stat.
* Timeout handling; usage-limit error detection.
* Scope-escape detection (ref snapshot + config/hooks hash) → event + BLOCK.

## Known invocations (from M0, verified)

* Claude: `claude -p "<prompt>" --allowedTools "Read,Write,Glob,Grep,Bash(grep *)"
  --output-format json --max-turns N` — reports cost/turns/duration.
* Codex: `codex exec --sandbox workspace-write -a never "<prompt>"` — tokens only;
  **never `--output-schema`** (forcing compliance hides whether the agent holds a
  contract on its own).
* Antigravity: IDE-based, no headless CLI, no telemetry — manual for now; the adapter
  represents it, invocation may be operator-mediated until a CLI exists.

## Non-goals

* The work-item state machine, routing, or automatic reassignment (M2/M3).
* The review/findings flow (M2/006) — this wrapper *runs* an agent; it does not yet
  interpret a review artifact.
* Predictive usage monitoring or dashboards (Const. XVI — reactive only).
* Sandboxing/prevention of escapes (detection only in v1).
* GitHub adapter.

## Open questions for the clarify gate

* How is Antigravity represented when it has no headless CLI — a manual-mediated
  adapter that still records runs and checkpoints, or deferred to a stub?
* What exactly counts as a "usage limit" signal per adapter (exit codes, stderr
  patterns), and how stable are those to detect on?
* `context` construction for a bare `minna run` (no work-item yet) — is it just the
  raw prompt, with structured context deferred to M2?
* Timeout defaults and what a timeout does (kill? leave running and block?).
* Where transcripts are stored and how they link to journal runs.
* Diff-stat computation: against the pre-run checkpoint base, presumably — confirm.

## Independent tests (CLI / git + journal assertions)

* `minna run` on a trivial edit task produces a pre-run and post-run checkpoint, a
  `run.started` and `run.finished` event, and a non-empty diff stat.
* A simulated usage-limit failure yields `run.failed(reason=usage_limited)`.
* An agent (or a stubbed one) that touches a ref or `.git/config` triggers a
  scope-escape event and BLOCK.
* An agent writing only to its declared scratch space does NOT trigger an escape.
* A timeout is recorded and blocks rather than silently proceeding.
* Telemetry captured matches what the adapter actually provides (and absence is handled,
  not faked).

## Dependencies

* 001-event-journal (records run events).
* 002-git-checkpoints (pre/post-run checkpoints; shares the ref-snapshot primitive).