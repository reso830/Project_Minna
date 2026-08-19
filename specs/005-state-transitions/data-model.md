# Data Model: Feature 005 State Transitions

## Overview

This document details the data structures, state matrix, event schemas, and database projection updates for Feature 005 State Transitions.

---

## Canonical State Transition Matrix

Derived from `minna-state-model.md` (v3). The core validator enforces all 8 legal transitions from the state model. The operator UI in Feature 005 exposes only the 6 operator-initiated actions.

| Current State (`from`) | Canonical Target States (`allowed`) | Legal UI Actions in Feature 005 |
|---|---|---|
| `parked` | `["active", "closed"]` | `Start` (quick phrase), `Close` (status chip dropdown) |
| `active` | `["parked", "blocked", "closed"]` | `Pause` (status chip dropdown), `Close` (status chip dropdown) |
| `blocked` | `["active", "parked", "closed"]` | `Pause` (status chip dropdown), `Close` (status chip dropdown) |
| `closed` | `[]` | None *(terminal state — no interactions)* |

*Note: `active → blocked` and `blocked → active` are supported in the core transition matrix, but require session context and are excluded from the Feature 005 operator UI.*

---

## Event Journal Model

State transitions persist exactly one `work_item.state_changed` event in the append-only journal in a single atomic SQLite transaction alongside the `work_items` projection update.

### State Changed Event (`work_item.state_changed`)

```json
{
  "type": "work_item.state_changed",
  "actor": "human",
  "payload": {
    "from": "parked | active | blocked | closed",
    "to": "parked | active | blocked | closed",
    "blocked_reason": "clarification-required | approval-required | external-dependency | ci-pending | failed | null",
    "closed_reason": "done | dropped | failed | null"
  }
}
```

---

## Current-State Projection (`work_items` table)

On every valid transition, the current-state projection is updated in the same SQLite transaction as the event write:

- `state`: Set to target state (`parked`, `active`, `blocked`, `closed`).
- `closed_reason`: Set to selected reason (`done`, `dropped`, `failed`) if `state == 'closed'`, otherwise `null`.
- `blocked_reason`: Preserved or set to `null` if leaving `blocked` state.
- `updated_at`: Set to current ISO 8601 UTC timestamp.

---

## Persistence Runtime

### SQLite Schema (Local)

- `events` table: Stores `type` (`work_item.state_changed`), `actor` (`human`), `payload` (JSON string), `timestamp`, `project`, `work_item_id`, `summary`.
- `work_items` table: Stores `id`, `state`, `closed_reason`, `blocked_reason`, `updated_at`.
- Transaction: `BEGIN TRANSACTION ... COMMIT` wraps both event insert and work item update.
