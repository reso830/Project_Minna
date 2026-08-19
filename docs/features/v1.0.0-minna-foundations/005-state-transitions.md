# Feature 005 - State Transitions

## Summary

Implement operator-triggered state transitions for work items within the Journal View.

This feature makes the work item state machine defined in the Minna State Model
functional for the first time. Work items created in Feature 003 are currently static —
nothing moves them between states. This feature introduces the controls and mechanisms
that let the operator explicitly transition a work item's state, and persists those
transitions as journal events.

---

## Background

The Minna State Model defines four states (`parked`, `active`, `blocked`, `closed`) and
eight legal transitions between them. No feature to date implements any of these
transitions — Feature 003 established the work item shape and the `Drop` action
(`→ closed`, `closed_reason: dropped`), but every other transition is unbuilt.

This feature is scoped to **operator-triggered** transitions only. Two transitions in the
canonical model — `active → blocked` (triggered by a session entering `needs_input`) and
`blocked → active` (triggered by an operator decision resolving that session) — depend on
the session model, which no feature has implemented yet. Those two transitions are
explicitly out of scope here; see Non-Goals.

---

## Objectives

- Allow the operator to start a `parked` work item (`parked → active`).
- Allow the operator to pause an in-progress or blocked work item (`active/blocked →
  parked`).
- Allow the operator to close a work item from any non-closed state (`parked/active/
  blocked → closed`), setting the appropriate `closed_reason`.
- Enforce the canonical transition table — only legal transitions from a work item's
  current state are ever presented or accepted.
- Persist every transition as a `work_item.state_changed` event.

---

## Scope

### Included

- "Start" quick-phrase action, shown above the composer, visible only for `parked` work
  items.
- Status chip hover-reveal dropdown, showing the legal transitions available from the
  work item's current state (e.g. Pause, Close).
- Transition validation against the canonical state table (`minna-state-model.md`) — an
  illegal transition must never be reachable through the UI, and must be rejected if
  attempted through any other path.
- `closed_reason` selection at the moment of closing (`done` / `dropped` / `failed`) via
  the status chip's `Close` action, which supersedes Feature 003's standalone `Drop`
  affordance — see Closing (below) for details.
- Writing the `work_item.state_changed` event (`from`, `to`, `blocked_reason`,
  `closed_reason`) for every transition performed by this feature.
- Updating the work item's `updated_at` timestamp on every transition.

### Excluded

- `active → blocked` (session enters `needs_input`) — depends on the session model, not
  yet implemented. No feature-005 UI shall claim to set a work item to `blocked`.
- `blocked → active` (operator resolves an agent's question) — same dependency; this is
  the `agent.question`/`human.decided` mechanism, which requires sessions to exist.
- Because both `blocked`-adjacent automatic transitions are out of scope, work items
  cannot naturally enter `blocked` under this feature. `blocked → parked` and `blocked →
  closed` are still implemented per the Included scope (a work item could arrive at
  `blocked` through a future feature or direct manipulation), but the UI will not exercise
  the `blocked` state until sessions exist.
- Phase transitions (`spec → plan → ... → integrate`) — a separate table in the canonical
  model; not covered by this feature.
- Board view.
- Any transition triggered automatically by Minna (execution completing, a gate passing,
  etc.) — this feature covers operator-initiated transitions only.
- Touch/mobile interaction — Minna is explicitly desktop-only; no tap-to-reveal fallback
  is required for the status chip dropdown.

---

## Functional Requirements

### Quick phrases — mechanism intent

Quick phrases are **never freeform text**. Each quick phrase maps to exactly one
predetermined, system-known action with a fixed payload — never a sentence for anything
downstream to interpret. Clicking a quick phrase performs that action directly; it is not
"a chat message that gets read and acted upon."

The rendered chat bubble (the phrase's label text, appended to the thread) is a cosmetic
echo for readability only. It has no bearing on what happens — the action already fired,
determined entirely by which chip was clicked, before or independent of anything being
written to the thread.

This mechanism is general, not limited to state transitions. A quick phrase may trigger a
state transition (e.g. `Start` → `parked → active`), or, in future features, other
predetermined actions such as a git operation (e.g. `Create a PR`, `Push to remote`, once
git integration exists) or a session/dispatch action. Every quick phrase must declare
which concrete action it triggers; there is no "send as freeform prompt to an agent"
variant of a quick phrase. A composer input that sends genuine freeform text to an agent
is a separate, pre-existing capability, not a quick phrase.

**For this feature specifically**, only one quick phrase is in scope: `Start`, shown for
`parked` work items, triggering `parked → active`. Any other quick-phrase content shown
in the accompanying design handoff (e.g. status/diff/blocker prompts for `active`/
`blocked` states) is placeholder from the design pass and does not represent real,
system-known actions available today — do not implement those as freeform-sending chips.
They may return in a future feature once the actions they'd need (git integration,
sessions) exist, built on the same mechanism described above.

---

### Start (quick phrase)

For a work item in the `parked` state, the Journal View composer area displays a "Start"
quick-phrase action above the input.

Clicking it performs `parked → active` and writes the corresponding event. The action is
not shown for work items in any other state.

---

### Status chip — hover dropdown

Hovering the work item's status chip reveals a dropdown listing only the transitions that
are legal from the chip's current state, per the canonical transition table:

| Current state | Legal actions offered |
|---|---|
| `parked` | Close |
| `active` | Pause, Close |
| `blocked` | Pause, Close |
| `closed` | (none — terminal, no dropdown shown) |

The dropdown requires a deliberate interaction to trigger a transition (hover reveals the
menu; a subsequent click on an action performs it) — hovering alone must never itself
change state.

The chip must display a visible affordance (e.g. a chevron or hover elevation) indicating
it is interactive, distinct from purely informational chips elsewhere in the UI.

---

### Closing — reason selection

Selecting "Close" from the status chip dropdown prompts the operator to choose a
`closed_reason`: `done`, `dropped`, or `failed`.

**`Close` replaces `Drop` as the single path to the `closed` state.** Feature 003's
separate `Drop` action (which set `closed_reason: dropped` directly, with no reason
prompt) is superseded by this flow — `Drop`'s prior behavior is now just the `dropped`
option within Close's reason prompt, not a separate control. There is only one way to
close a work item from the UI going forward; remove or repurpose Feature 003's standalone
`Drop` affordance rather than keeping it alongside this dropdown.

---

### Transition validation

Before performing any transition, the system shall verify it against the canonical table
in `minna-state-model.md`. This validation must exist at the layer that actually performs
the write (not only in the UI's rendering logic), so that no caller — UI, CLI, or a future
feature — can force an illegal transition.

---

### Event recording

Every transition writes one `work_item.state_changed` event:

```json
{
  "type": "work_item.state_changed",
  "actor": "human",
  "payload": {
    "from": "parked",
    "to": "active",
    "blocked_reason": null,
    "closed_reason": null
  }
}
```

`blocked_reason` and `closed_reason` are populated only when relevant to the transition
(entering `blocked` or `closed` respectively); otherwise `null`.

---

## Design Reference

Design handoff: `minna-state-quick-phrases` (status chip dropdown + quick phrases +
compose bar). High-fidelity for layout, styling, and interaction states — implement as
specified.

**Scope note:** the handoff is a frontend/visual artifact only. Its "State Management"
section describes component-local state for illustrative purposes (e.g. "mutate the
selected feature's `status` field directly") and does not describe or replace the actual
backend write path. The requirements in this brief — transition validation against the
canonical table, and writing a `work_item.state_changed` event for every transition (see
Event recording, above) — apply regardless of what the handoff's pseudocode shows. The
handoff governs what it looks and feels like; this brief governs what actually gets
persisted.

---

## References

This feature shall conform to:

- `minna-state-model.md` (v3) — state definitions, transition table, `blocked_reason`,
  `closed_reason`.
- `minna-event-model.md` (v2) — `work_item.state_changed` event shape.

---

## Acceptance Criteria

- A `parked` work item shows the Start quick phrase; no other state does.
- Clicking Start transitions the work item to `active` and writes the event.
- The status chip's dropdown shows only the actions legal from the current state, per the
  table above.
- Attempting an illegal transition (through any path, not just the UI) is rejected.
- Closing a work item prompts for and correctly records `closed_reason`.
- Every transition performed by this feature writes a `work_item.state_changed` event
  with the correct `from`/`to`/`blocked_reason`/`closed_reason`.
- No UI in this feature sets a work item to `blocked`.
- `updated_at` is refreshed on every transition.
- The feature operates entirely offline; no session or agent execution is required.

---

## Notes

This feature makes the state half of the work item model operational. Phase transitions,
and the two session-dependent transitions (`active → blocked`, `blocked → active`),
remain for future features once the session model is implemented. At that point, the
`blocked` state — reachable but unexercised under this feature — becomes a live part of
the normal work item lifecycle.