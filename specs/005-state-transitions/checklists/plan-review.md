**Gate result**: PASS (reviewed 2026-08-19)

# Plan Review Checklist: Feature 005 State Transitions

**Purpose**: Validate technical plan completeness, architecture soundness, and constitution compliance BEFORE writing implementation code.
**Created**: 2026-08-19
**Feature**: [plan.md](../plan.md) | **Spec**: [spec.md](../spec.md)

## Spec & Scope Alignment

- [x] Plan covers all functional requirements from spec.md (Start quick phrase, status chip hover dropdown, Close reason modal, core validation, single `work_item.state_changed` event).
- [x] Non-goals (session transitions `active → blocked`, `blocked → active`, phase transitions, board view) are explicitly excluded in plan.
- [x] Deprecation/removal of Feature 003 `/drop` API route and `DropConfirmModal` is addressed in plan.
- [x] QuickPhrasesBar is explicitly scoped to render ONLY for `parked` state in Feature 005.

## Architecture & Design

- [x] Centralized state transition validation rule (`validateStateTransition`) is defined in core model (`src/core/work-item-model.ts`) with full 8-transition matrix.
- [x] Same-state phase updates (`next.state === current.state`) bypass state-change transition validation.
- [x] Event journal atomicity is specified (single `work_item.state_changed` event committed in single transaction with `work_items` update).
- [x] Status chip dropdown hover bridge (6px padding-top container) is specified to prevent hover flicker.

## Data Model & API Contracts

- [x] Data model (`data-model.md`) aligns with canonical `minna-state-model.md` 8-transition matrix.
- [x] API contract (`contracts/api.md`) defines `PATCH /api/work-items/[id]/state` with 200 OK and 422 Unprocessable Entity (`{ error, from, to, allowed }`) response schemas, using valid `"parked" | "active" | "blocked" | "closed"` request syntax.
- [x] Local SQLite persistence strategy is primary and offline-capable.

## Constitution Compliance

- [x] Principle I (Human Authority): All state transitions are human-gated via explicit UI actions.
- [x] Principle II (Deterministic Orchestration): Validation matrix is explicit and deterministic.
- [x] Principle III (State Is Source of Truth): Same-transaction event write + current state projection update.
- [x] Principle IV (Thin Interfaces): Business logic in core services; API and UI are thin wrappers.
- [x] Principle VI (Local-First): SQLite local persistence primary.
- [x] Required-field impact assessed (core `WorkItem` fields updated; application fields unaffected).
- [x] No new external dependencies introduced.

## Test Strategy

- [x] Unit tests planned for core validation matrix (`validateStateTransition`) covering all 16 state pair combinations.
- [x] Audit task planned for existing unit tests (`work-items.test.ts`, `db.test.ts`) to ensure backwards compatibility.
- [x] API contract tests planned for 200 OK success, 422 illegal transition, and 400 missing reason.
- [x] UI component tests planned for status chip hover dropdown, Start quick phrase, and Close modal.
