# Feature Specification: State Transitions

**Feature Branch**: `005-state-transitions`
**Created**: 2026-08-19
**Status**: Draft
**Input**: [005-state-transitions.md](file:///D:/Alvin/_CodeProjects/Project_Minna/docs/features/v1.0.0-minna-foundations/005-state-transitions.md)

## Clarifications

### Session 2026-08-19

- **Q1**: How should the UI prompt for the `closed_reason` (`done`, `dropped`, `failed`) when the operator selects "Close" from the status chip dropdown?
  → **A**: Display a modal or popover confirmation dialog asking the operator to select a reason (`done` / `dropped` / `failed`) before confirming the transition.
- **Q2**: What event is written when a state transition occurs?
  → **A**: Exactly one `work_item.state_changed` event is written per transition, strictly adhering to the feature brief (lines 168-184) and canonical event model (`docs/minna-event-model.md`). No extra event types (`human.triggered`) are introduced.
- **Q3**: How should Feature 003's standalone `Drop` backend API (`POST /api/work-items/[id]/drop`) and `DropConfirmModal` component be handled?
  → **A**: Remove `DropConfirmModal` and remove `POST /api/work-items/[id]/drop` entirely (do not alias it). All state transitions, including closing as dropped, go through the single unified state-transition API (`PATCH /api/work-items/[id]/state` calling `updateWorkItemState`).
- **Q4**: When an illegal state transition is attempted via the core service or API endpoint, what response and error model should be returned?
  → **A**: The core service throws a structured error containing `{ from, to, allowed }` (where `allowed` lists legal target states per `minna-state-model.md`). The API layer returns HTTP 422 Unprocessable Entity with a structured payload `{ error: "Illegal state transition", from, to, allowed: [...] }`.

---

## Problem Statement

Work items created in Feature 003 are currently static — no mechanism exists to move them between states except Feature 003's standalone `Drop` action (`→ closed`, `closed_reason: dropped`). The Minna State Model defines four states (`parked`, `active`, `blocked`, `closed`) and eight legal transitions between them.

This feature introduces operator-triggered state transitions in the Journal View:
1. "Start" quick-phrase action for `parked` work items (`parked → active`).
2. Status chip hover-reveal dropdown for pausing (`active/blocked → parked`) and closing (`parked/active/blocked → closed`).
3. Confirmation dialog for selecting `closed_reason` (`done` / `dropped` / `failed`) when closing, replacing Feature 003's standalone `Drop` action.
4. Core service validation enforcing the 8-transition canonical matrix and persisting a single `work_item.state_changed` event in SQLite.

---

## Scope

### In Scope

- **Start Quick-Phrase Action**:
  - Rendered in the Journal View composer area above the chat input, visible **only** when the selected work item state is `parked`.
  - Clicking "Start" executes `parked → active`, writes `work_item.state_changed` (`from: "parked", to: "active"`), and updates work item state to `active`.
  - For all other states (`active`, `blocked`, `closed`), no quick phrases bar is rendered in Feature 005.
- **Status Chip Hover Dropdown**:
  - Hovering the work item's status chip reveals a dropdown showing only legal operator actions from the current state:
    - `parked`: `Close`
    - `active`: `Pause`, `Close`
    - `blocked`: `Pause`, `Close`
    - `closed`: *(none — terminal state; chip is non-interactive)*
  - Includes a 6px top-padding bridge in the wrapper container to prevent mouse-leave flickering when moving cursor between chip and dropdown menu.
  - Hovering alone must never mutate state; transition occurs only on explicit click.
  - Interactive chip affordance (chevron indicator or hover elevation).
- **Closing with Reason Selection Modal/Popover**:
  - Selecting "Close" opens a confirmation dialog prompting the operator to choose a `closed_reason`: `done`, `dropped`, or `failed`.
  - Confirming writes `work_item.state_changed` (`{ from, to: "closed", closed_reason }`), updating `state` to `closed`.
  - Replaces Feature 003's standalone `DropConfirmModal` and `POST /api/work-items/[id]/drop` API endpoint entirely (which are removed).
- **Transition Validation & API Design**:
  - Unified state-transition API endpoint `PATCH /api/work-items/[id]/state`.
  - Core write layer (`updateWorkItemState` in `src/core/work-items.ts`) validates state changes (`next.state !== current.state`) against the 8-transition canonical matrix in `minna-state-model.md`.
  - Same-state updates (e.g. phase updates where `next.state === current.state`) bypass state-change transition validation.
  - Core service throws a custom `IllegalStateTransitionError` carrying `{ from, to, allowed }`.
  - API layer returns HTTP 422 Unprocessable Entity with `{ error: "Illegal state transition from '<from>' to '<to>'.", from, to, allowed: [...] }` when an illegal transition is attempted.
- **Event Recording & State Projection**:
  - Every transition writes exactly one `work_item.state_changed` event in the same SQLite transaction as the `work_items` table update.
  - Refreshes `updated_at` on every transition.

### Non-Goals

- `active → blocked` (session enters `needs_input`) — depends on session model (unbuilt). No UI in Feature 005 sets a work item to `blocked`.
- `blocked → active` (operator resolves question) — depends on session model (unbuilt).
- Implementing active/blocked quick phrases ("What's the status?", etc.) from design handoff — explicitly excluded per feature brief (lines 104-111).
- Phase transitions (`spec → plan → ... → integrate`).
- Board view.
- Automatic system-triggered transitions (execution finishing, gate passing).
- Touch/mobile interaction fallbacks (Minna is desktop-only).
- Freeform text parsing for quick phrases (quick phrases execute fixed system-known actions).
- Hosted Supabase integration (Feature 005 is strictly local SQLite).

---

## User Scenarios & Testing

### User Story 1 - Start Parked Work Item (Priority: P1)

As an operator, I want to click a "Start" quick-phrase action on a parked work item so that I can move it into the active state and begin work.

* **Why this priority**: Core workflow entry point to begin work on a queued item.
* **Independent Test**: Open a `parked` work item in Journal View. Verify the "Start" quick-phrase chip is displayed above the compose input. Click "Start". Verify status chip changes to `active` (accent cyan background `#00F0FF`), the "Start" chip disappears, and a `work_item.state_changed` event (`from: parked, to: active`) is recorded in the timeline.
* **Acceptance Scenarios**:
  1. **Given** a work item in `parked` state, **When** viewed in Journal View, **Then** the "Start" quick-phrase action is rendered above the compose bar.
  2. **Given** a work item in `active`, `blocked`, or `closed` state, **When** viewed in Journal View, **Then** the quick-phrase bar is NOT displayed.
  3. **Given** a `parked` work item, **When** the operator clicks "Start", **Then** a `work_item.state_changed` event is written in a single SQLite transaction, the work item state updates to `active`, and `updated_at` is refreshed.

### User Story 2 - Status Chip Dropdown & Legal Transitions (Priority: P1)

As an operator, I want to hover over the status chip to see only valid operator transitions for the item's current state so that I can pause or close it without invalid state errors.

* **Why this priority**: Essential UI control for explicit state management.
* **Independent Test**: Hover status chip for an `active` work item — verify "Pause" and "Close" are shown. Click "Pause" — verify state updates to `parked` and event `work_item.state_changed` is logged. Hover chip on `parked` item — verify only "Close" is shown. Hover chip on `closed` item — verify no dropdown appears.
* **Acceptance Scenarios**:
  1. **Given** an `active` or `blocked` work item, **When** operator hovers status chip, **Then** dropdown presents "Pause" and "Close".
  2. **Given** a `parked` work item, **When** operator hovers status chip, **Then** dropdown presents only "Close".
  3. **Given** a `closed` work item, **When** operator hovers status chip, **Then** chip displays no dropdown and responds to no click action.
  4. **Given** an `active` or `blocked` work item, **When** operator clicks "Pause", **Then** state transitions to `parked` (`active/blocked → parked`) and event `work_item.state_changed` is written.

### User Story 3 - Closing with Reason Selection Dialog (Priority: P1)

As an operator, I want selecting "Close" to prompt me with a confirmation dialog for a closing reason (`done`, `dropped`, `failed`) so that the outcome is accurately recorded in history.

* **Why this priority**: Replaces Feature 003's unspecific standalone `Drop` modal with structured outcome logging.
* **Independent Test**: Select "Close" on an `active` work item. Verify confirmation dialog appears with reason choices (`done`, `dropped`, `failed`). Select `done` and confirm. Verify work item transitions to `closed`, `closed_reason` is set to `"done"`, and `work_item.state_changed` event records `closed_reason: "done"`. Confirm standalone Feature 003 `DropConfirmModal` and `POST /api/work-items/[id]/drop` API endpoint are removed.
* **Acceptance Scenarios**:
  1. **Given** any non-closed work item, **When** operator clicks "Close" in the status chip dropdown, **Then** a confirmation dialog opens prompting for `closed_reason` (`done` / `dropped` / `failed`).
  2. **Given** a reason is selected and confirmed in the dialog, **When** transition executes via `PATCH /api/work-items/[id]/state`, **Then** work item state becomes `closed`, `closed_reason` is saved, and event payload includes `closed_reason`.
  3. **Given** Feature 005 is implemented, **When** checking the codebase, **Then** Feature 003's `DropConfirmModal` and `/api/work-items/[id]/drop` route are removed, replaced by the unified state transition flow.

### User Story 4 - Core Validation & HTTP 422 Error Handling (Priority: P1)

As an operator, I want state transitions to be validated at the core service layer so that illegal transitions return structured error data to callers and callers receive HTTP 422 Unprocessable Entity.

* **Why this priority**: Governed by Constitution Principle II (Deterministic Orchestration) and Principle III (State Is Source of Truth).
* **Independent Test**: Send `PATCH /api/work-items/[id]/state` with an illegal transition (`parked → blocked` or `closed → active`). Verify HTTP status is 422 Unprocessable Entity and response body contains `{ error: "Illegal state transition from 'parked' to 'blocked'.", from: "parked", to: "blocked", allowed: ["active", "closed"] }`.
* **Acceptance Scenarios**:
  1. **Given** an illegal transition attempt (`parked → blocked` or `closed → active`), **When** `updateWorkItemState` is called, **Then** core service throws `IllegalStateTransitionError` containing `{ from, to, allowed }`, transaction rolls back, and API returns HTTP 422.
  2. **Given** a legal transition, **When** `updateWorkItemState` is called, **Then** `events` table insertion (`work_item.state_changed`) and `work_items` table update occur in a single `BEGIN TRANSACTION ... COMMIT` block.

---

## Edge Cases

- **Flicker on Hovering Status Dropdown**: A 6px invisible padding-top bridge between the status chip and the dropdown container ensures moving the cursor from chip to dropdown does not trigger a mouse-leave event.
- **Attempting State Change on Terminal `closed` State**: `closed` state is strictly terminal. Core service rejects any transition starting from `closed` with allowed `[]`.
- **Same-State Phase Updates**: Calling `updateWorkItemState` with `next.state === current.state` (e.g. updating phase) bypasses state-change validation and updates phase smoothly without error.
- **Missing `closed_reason` on Closing**: Attempting to set state to `closed` without providing a valid `closed_reason` (`done` | `dropped` | `failed`) fails validation.
- **Non-null `closed_reason` on Non-Closed States**: Setting `closed_reason` on `parked`, `active`, or `blocked` states fails validation.
- **Database Transaction Atomicity**: If event insertion fails, the work item state update is rolled back immediately, preserving event journal integrity.

---

## Data Considerations

### Canonical Transition Matrix (`minna-state-model.md`)

| From | Legal Target States (`allowed`) |
|---|---|
| `parked` | `["active", "closed"]` |
| `active` | `["parked", "blocked", "closed"]` |
| `blocked` | `["active", "parked", "closed"]` |
| `closed` | `[]` *(terminal)* |

### WorkItem Schema Fields

- `state`: `'parked' | 'active' | 'blocked' | 'closed'`
- `closed_reason`: `'done' | 'dropped' | 'failed' | null`
- `blocked_reason`: `'clarification-required' | 'approval-required' | 'external-dependency' | 'ci-pending' | 'failed' | null`
- `updated_at`: ISO 8601 string, updated on every transition.

### Event Journal Record (Single Event per Transition)

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
