# Technical Plan: State Transitions

**Branch**: `005-state-transitions` | **Date**: 2026-08-19 | **Spec**: [spec.md](file:///D:/Alvin/_CodeProjects/Project_Minna/specs/005-state-transitions/spec.md)
**Input**: [005-state-transitions.md](file:///D:/Alvin/_CodeProjects/Project_Minna/docs/features/v1.0.0-minna-foundations/005-state-transitions.md) & design handoff `minna-state-quick-phrases`

## Summary

This plan outlines the architecture, data flow, affected components, local SQLite persistence strategy, and validation approach for implementing Feature 005 - State Transitions.

We will make the Minna work item state machine operational for operator-initiated transitions:
1. **Start Quick Phrase**: For `parked` work items, render a "Start" quick-phrase action above the compose box that triggers `parked → active`. QuickPhrasesBar is rendered ONLY when state is `parked` (active/blocked quick phrases from handoff are explicitly excluded per brief).
2. **Status Chip Hover Dropdown**: Render a dropdown on status chip hover listing legal operator actions (`parked`: Close; `active`/`blocked`: Pause, Close; `closed`: none).
3. **Closing Reason Selection Modal**: Selecting "Close" opens a confirmation dialog to pick `closed_reason` (`done`, `dropped`, `failed`), setting state to `closed`. Replaces Feature 003's standalone `DropConfirmModal` and `/drop` route entirely.
4. **Core Validation & Single-Event Logging**: Enforce transition validation against the full 8-transition canonical matrix (`minna-state-model.md`). Every transition writes exactly one `work_item.state_changed` event and updates the `work_items` projection in a single SQLite transaction. Same-state updates (e.g. phase updates) bypass state-change validation.

Persistence is scoped strictly to local SQLite (`.minna/minna.db`), matching the offline-only requirement of the feature brief.

---

## Technical Context

- **Language/Version**: TypeScript / Node.js 22+ (Next.js 15 App Router), React 19.
- **Primary Dependencies**: React, CSS modules / Tailwind / inline SVG icons. Zero new npm packages.
- **Storage**: Local SQLite (`.minna/minna.db` using Node's `DatabaseSync`) via `createRepositories(config)`.
- **Testing**: Jest / React Testing Library for components, Node test runner / Jest for core validation.
- **Target Platform**: Desktop browsers (Chrome, Edge, Firefox, Safari) and local shell CLI.
- **Performance Goals**: State transition processing <50ms; UI dropdown hover response instant (<16ms).
- **Constraints**: Strict validation against canonical 8-transition state matrix; single-event logging (`work_item.state_changed`); 422 Unprocessable Entity error payloads for illegal transitions.

---

## Constitution Check

*GATE: Must pass before implementation.*

### I. Human Authority & Decision-Making
- **Compliance**: Transitions are explicitly initiated by the operator via UI controls (Start quick phrase, status chip dropdown). System does not autonomously force state transitions.

### II. Deterministic Orchestration
- **Compliance**: Transitions validate strictly against `minna-state-model.md`. A single `work_item.state_changed` event records exact actor (`human`) and transition payload (`from`, `to`, `blocked_reason`, `closed_reason`).

### III. State Is The Source Of Truth
- **Compliance**: `work_item.state_changed` event and `work_items` table update are committed in a single atomic SQLite transaction. Current state is a re-derivable projection.

### IV. Thin Interfaces & Core Logic
- **Compliance**: Transition rules and event creation reside in core services (`src/core/work-items.ts`, `src/core/work-item-model.ts`). API handlers (`PATCH /api/work-items/[id]/state`) and UI components are thin wrappers around core logic.

### VI. Local-First, Inspectable State
- **Compliance**: Local SQLite persistence is primary and offline-capable.

### XIII. Minna Owns Git; Agents Are Subprocesses
- **Compliance**: Feature handles operator state transitions. No agent capabilities or git mutation authorities are granted.

### XVI. Cost & Quota Are First-Class
- **Compliance**: Runs entirely on local resources with zero API cost.

### Required-Field Impact
- Feature operates on core `WorkItem` fields (`state`, `closed_reason`, `blocked_reason`, `updated_at`). Constitution application data fields (`company`, `job_title`, etc.) are unaffected.

### Centralized Validation Rules
- `validateStateTransition(current, next)` in `src/core/work-item-model.ts` is the single source of truth for transition legality across UI, API, and CLI.

### Dependency Justification
- Zero new dependencies added.

---

## Affected Areas

### Files/Components to Inspect
- [src/core/types.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts): Event and WorkItem types.
- [src/core/work-item-model.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/work-item-model.ts): State definitions and presentation.
- [src/core/work-items.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/work-items.ts): Core CRUD and state management.
- [src/components/CenterPanel.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/CenterPanel.tsx): Header, timeline, and compose UI.
- [src/components/WorkspaceProvider.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/WorkspaceProvider.tsx): State management context.
- [src/core/__tests__/work-items.test.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/__tests__/work-items.test.ts): Existing work items tests.
- [src/core/db.test.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/db.test.ts): Existing database tests.

### Files/Components to Modify
- [src/core/work-item-model.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/work-item-model.ts):
  - Add full 8-transition `CANONICAL_TRANSITIONS` matrix (`parked → active, closed`; `active → parked, blocked, closed`; `blocked → active, parked, closed`; `closed → none`).
  - Add `validateStateTransition(fromState, toState)` and export `IllegalStateTransitionError` carrying `{ from, to, allowed }`.
- [src/core/work-items.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/work-items.ts):
  - Update `updateWorkItemState`: if `next.state !== current.state`, validate via `validateStateTransition`. Write single `work_item.state_changed` event and update `work_items` projection table in one SQLite transaction. If `next.state === current.state`, bypass transition validation and proceed with phase/metadata update.
- [src/components/CenterPanel.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/CenterPanel.tsx):
  - Add hover dropdown on `.journal-status` with legal operator transition items and 6px top-padding bridge.
  - Add `QuickPhrasesBar` above compose box, rendering "Start" ONLY for `parked` work items.
  - Update compose box with 2-row `<textarea>` (`rows={2}`) and 56x56 Send button.
- [src/components/WorkspaceProvider.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/WorkspaceProvider.tsx):
  - Replace `dropFeature` with `transitionFeatureState(featureId, nextState, closedReason?)`.
  - Handle `CloseReasonModal` trigger and state transitions.

### Files to Remove
- `src/app/api/work-items/[id]/drop/route.ts`: Removed (superseded by `/state`).
- `src/components/DropConfirmModal.tsx`: Removed (superseded by `CloseReasonModal`).

### New Files to Create
- `src/app/api/work-items/[id]/state/route.ts`: API endpoint (`PATCH`) for state transitions. Accepts state (`parked` | `active` | `blocked` | `closed`) and `closed_reason`. Returns 200 OK or 422 Unprocessable Entity with `{ error, from, to, allowed }`.
- `src/components/CloseReasonModal.tsx`: Confirmation modal prompting for `closed_reason` (`done` / `dropped` / `failed`).
- `src/components/QuickPhrasesBar.tsx`: Component rendering quick phrases above compose bar for `parked` state.
- `src/components/StatusChipDropdown.tsx`: Component rendering hover-reveal legal state transition options.

### Tests to Add or Update
- `src/core/__tests__/work-item-state.test.ts`: Core validation matrix (8 legal, 8 illegal state pairs) tests.
- `src/core/__tests__/work-items.test.ts` & `src/core/db.test.ts`: Reconcile existing test cases with new validation logic.
- `src/app/api/work-items/__tests__/state.test.ts`: API endpoint integration tests (200 success, 422 invalid transition with structured allowed list, 400 missing closed_reason).
- `src/components/__tests__/CenterPanel.test.tsx`: Status dropdown hover rendering, Start quick phrase click execution, Close modal flow.

### Areas Explicitly Out of Scope
- Automatic `active → blocked` and `blocked → active` session transitions (supported in core matrix, but excluded from Feature 005 UI).
- Phase transitions (`spec → plan → ... → integrate`).
- Board view state drag-and-drop.
- Hosted Supabase persistence layer.

---

## Architecture & Data Flow

```text
Operator Action (Click Start / Hover Status -> Select Action / Select Close Reason)
       │
       ▼
CenterPanel Component / WorkspaceProvider (`transitionFeatureState`)
       │
       ▼
PATCH /api/work-items/[id]/state
       │
       ▼
core/work-items.ts (`updateWorkItemState`)
       │
       ├─► Check if next.state !== current.state
       │     └─► validateStateTransition(current.state, next.state)
       │           └─► Throws IllegalStateTransitionError({ from, to, allowed }) if invalid
       │
       ▼
SQLite Database Write (in single transaction)
       │
       ├──► INSERT INTO events (type: 'work_item.state_changed', payload: { from, to, blocked_reason, closed_reason })
       └──► UPDATE work_items SET state = ?, closed_reason = ?, updated_at = ? WHERE id = ?
       │
       ▼
Returns Updated WorkItem -> API Status 200 OK -> UI State Refreshes
```

---

## Risks and Tradeoffs

- **Risk**: Cursor moving off status chip closes dropdown before user clicks.
  - **Mitigation**: 6px invisible `padding-top` bridge inside the dropdown wrapper container keeps hover state active while crossing from chip to menu.
- **Risk**: Legacy clients calling `/api/work-items/[id]/drop`.
  - **Mitigation**: Endpoint is completely removed. Any attempt to hit `/drop` returns HTTP 404/405, forcing consumption of the unified `PATCH /api/work-items/[id]/state`.

---

## Validation Approach

1. **Unit & Core Tests**: Verify `validateStateTransition` for all 16 state pair combinations (4 start states x 4 end states). Assert allowed arrays match `minna-state-model.md`'s 8 legal transitions. Reconcile existing test suite.
2. **API Contract Tests**: Test `PATCH /api/work-items/[id]/state` for legal transitions (200 OK), illegal transitions (422 Unprocessable Entity with `from`, `to`, `allowed`), and missing `closed_reason` on `closed` state (400 Bad Request).
3. **UI Integration Tests**: RTL tests for status chip dropdown hover/focus, Start quick phrase click, and Close reason modal selection.
