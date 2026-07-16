# 001-event-journal

> Feature brief — input to `/specify`. States intent, scope, and the constitutional
> constraints that bind this feature. Open questions are left for the clarify gate;
> do not pre-answer them here.

## Feature Overview

The event journal is Minna's source of truth. It is an **append-only log of events**
in SQLite, with a **same-transaction** current-state projection. Everything else Minna
builds writes to it; every recovery, audit, and status view reads from it.

This feature **supersedes** the scaffold's `src/core/state.ts` (file-backed mutable
JSON), which is rejected by Constitution III and VI.

It is the first feature of M1 because every later feature (checkpoints, agent runs,
reviews) records its history here, and because `minna log` is how the operator will
debug everything that follows.

## Why this exists

The retired `ai-flow.ps1` had no durable, inspectable record of what happened — gate
state lived in scattered untracked files and was derived from LLM prose. Minna's answer
is a single append-only journal from which current state is re-derived, so that "what
happened, in what order, and does the current state match the history" is always
answerable.

## Goals

* Establish the append-only event log as the authoritative store.
* Make current state a projection that is re-derivable from events.
* Give the operator a human-readable timeline and a consistency check.
* Provide the persistence primitive every later M1/M2 feature writes to.

## Constitutional constraints (must hold)

* **Append-only** — events are never updated or deleted (Const. III).
* **Same-transaction writes** — every current-state mutation and its event are written
  in the same SQLite transaction; a mutation without its paired event is a CRITICAL
  violation (Const. III).
* **Projection, not duplicate truth** — current-state tables are derived from events
  and must be reconcilable against them (Const. III).
* **Inspectable, recoverable, exportable** — not a hand-editable flat file; human
  readability comes from tooling and export, not the storage format (Const. VI).
* **Local-first** — `.minna/minna.db`; no hosted or external store (Const. VI).

## In scope

* The `events` table (append-only) and its write path.
* At least the current-state projection needed to prove the mechanism end-to-end
  (the minimal set — likely a work-item/feature identity table — sufficient to
  demonstrate same-transaction writes and re-derivation).
* `minna log` — render the human-readable timeline.
* `minna verify` — re-derive state from events, diff against the projection, report drift.
* `minna export` — write a human-readable timeline into a target directory for committing.
* A documented event envelope (id, timestamp, actor, type, payload) and an initial,
  small set of event types sufficient for this feature.

## Non-goals

* Checkpoints and any git operations (002).
* Running agents or adapters (003).
* The full work-item state machine and its many event types (M2/004).
* Findings, reviews, approvals (M2/006–007).
* Multi-project or multi-operator concerns.
* Any migration/replay framework — pragmatic journal, not full event sourcing
  (a `verify`-style consistency check is in scope; projection-rebuild-as-recovery is not).

## Behavior (CLI, indicative — refine in spec)

* `minna log [--feature <id>]` → ordered timeline.
* `minna verify` → exit non-zero and report if events and projection disagree.
* `minna export <dir>` → committable human-readable timeline.
* (Event *writing* is a library API used by later features, not a user command; a
  minimal command to create/record something is needed only insofar as it proves the
  write path.)

## Open questions for the clarify gate

* What is the minimal projection to build now to prove the mechanism without pulling
  M2's work-item model forward? A bare feature-identity table, or something smaller?
* Event envelope specifics: is `actor` a free string, an enum (human/system/agent-id),
  or both? What is the payload discipline (typed per event vs opaque JSON)?
* `minna verify` scope: structural consistency only, or also invariant checks
  (e.g. no state without a creating event)?
* Export format: Markdown timeline, JSONL, or both? Where does it land relative to a
  feature directory?
* SQLite access approach and migrations strategy (choose the lightest thing that
  honors the constraints; justify any dependency per Const. XII).

## Independent tests (CLI / state assertions — no browser)

* After a sequence of recorded events, `minna log` shows them in order with correct
  actor/type.
* Killing the process mid-sequence and reopening leaves the journal internally
  consistent; `minna verify` passes.
* Deliberately corrupting/omitting a projection row makes `minna verify` fail and name
  the drift.
* `minna export` produces a file whose contents match the timeline and can be committed.

## Dependencies

None (this is the foundation). Supersedes `src/core/state.ts`.