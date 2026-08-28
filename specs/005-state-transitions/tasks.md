# Tasks: State Transitions

**Input**: Design documents from [specs/005-state-transitions/](file:///D:/Alvin/_CodeProjects/Project_Minna/specs/005-state-transitions/)
**Prerequisites**: [plan.md](file:///D:/Alvin/_CodeProjects/Project_Minna/specs/005-state-transitions/plan.md) (required), [spec.md](file:///D:/Alvin/_CodeProjects/Project_Minna/specs/005-state-transitions/spec.md) (required)

## Conventions Header

- **Status Legend**: `[x]` done · `[ ]` pending · `[~]` skipped
- **Parallel Execution**: Tasks marked `[P]` can run in parallel (different files, no shared edits)
- **Phase Dependency**: `Phase 01 → Phase 02 → Phase 03 → Phase 04 → Phase 05 → Phase 06 → Phase 07 → Phase 08`
- **Verification Commands**:
  - `npm run test` (runs unit, API, and component tests)
  - `npm run build:cli` (compiles CLI and core services)
  - `npm run lint` (runs ESLint checks)

### Phase Summary Table

| Phase | Name / Focus | Task ID Range | User Stories Covered |
| --- | --- | --- | --- |
| **01** | Core Validation Matrix & Error Model | `T001–T002` | US4 |
| **02** | Core Service Single-Event Write & Test Audit | `T003–T005` | US1, US2, US3, US4 |
| **03** | Unified State API & Endpoint Cleanup | `T006–T007` | US3, US4 |
| **04** | Status Chip Dropdown & Close Reason Modal | `T008–T010` | US2, US3 |
| **05** | Quick Phrases Bar & Compose Bar Polish | `T011–T013` | US1 |
| **06** | Component Integration & RTL Tests | `T014` | US1, US2, US3, US4 |
| **07** | Release Prep | `T015` | — |
| **08** | Browser Smoke Test | `T016` | US1, US2, US3, US4 |

---

## Phase 01: Core Validation Matrix & Error Model (Priority: P1)

**Purpose**: Implement centralized transition validation against `minna-state-model.md` 8-transition matrix and export structured `IllegalStateTransitionError`.

- [x] T001 [P] Implement 8-transition validation matrix and IllegalStateTransitionError in src/core/work-item-model.ts
  * **Target Files**: [src/core/work-item-model.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/work-item-model.ts)
  * **Expected Behavior**: Export `CANONICAL_TRANSITIONS: Record<WorkItemState, WorkItemState[]>` mapping `parked → ["active", "closed"]`, `active → ["parked", "blocked", "closed"]`, `blocked → ["active", "parked", "closed"]`, `closed → []`. Export class `IllegalStateTransitionError extends Error` carrying properties `{ from: WorkItemState, to: WorkItemState, allowed: WorkItemState[] }`. Export `validateStateTransition(fromState, toState)` throwing `IllegalStateTransitionError` if transition is invalid.
  * **Constraints**: Pure function; zero external dependencies.
  * **Validation/Test Location**: `npm run build:cli`

- [x] T002 [P] Add unit tests for 8-transition matrix in src/core/__tests__/work-item-state.test.ts
  * **Target Files**: `src/core/__tests__/work-item-state.test.ts`
  * **Expected Behavior**: Add test coverage testing all 16 state pair combinations. Verify 8 legal transitions pass without error and 8 illegal transitions throw `IllegalStateTransitionError` with populated `from`, `to`, and `allowed` properties.
  * **Constraints**: Test legal pairs (`parked → active`, `parked → closed`, `active → parked`, `active → blocked`, `active → closed`, `blocked → active`, `blocked → parked`, `blocked → closed`) and illegal pairs (`parked → blocked`, `closed → active`, `closed → parked`, `closed → blocked`, `closed → closed`, `parked → parked`, `active → active`, `blocked → blocked`).
  * **Validation/Test Location**: `npm run test`

---

## Phase 02: Core Service Single-Event Write & Test Audit (Priority: P1)

**Purpose**: Refactor `updateWorkItemState` to validate state changes (`next.state !== current.state`), emit single `work_item.state_changed` event, update `work_items` projection table in one SQLite transaction, and reconcile existing core tests.

- [x] T003 Refactor updateWorkItemState in src/core/work-items.ts for single-event transaction logging
  * **Target Files**: [src/core/work-items.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/work-items.ts)
  * **Expected Behavior**: Refactor `updateWorkItemState`. If `next.state !== current.state`, validate via `validateStateTransition(current.state, next.state)`. Write single `work_item.state_changed` event (`{ from, to, blocked_reason, closed_reason }`) with `actor: "human"` (or input actor) and update `work_items` table in a single SQLite transaction. If `next.state === current.state`, bypass state transition validation to support same-state phase/metadata updates without breaking non-transition callers. Assert `closed_reason` consistency (`closed_reason` required when state is `closed`; must be `null` otherwise).
  * **Constraints**: Must maintain single-event transaction atomicity per Constitution Principle III and feature brief lines 168-184.
  * **Validation/Test Location**: `npm run build:cli`

- [x] T004 Audit and reconcile existing core tests in src/core/__tests__/work-items.test.ts and src/core/db.test.ts
  * **Target Files**: [src/core/__tests__/work-items.test.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/__tests__/work-items.test.ts), [src/core/db.test.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/db.test.ts)
  * **Expected Behavior**: Audit existing tests that call `updateWorkItemState`. Verify phase-only updates (same state) continue to pass. Update any tests performing state transitions to expect valid transitions and match the canonical single `work_item.state_changed` event schema.
  * **Constraints**: Existing core test suite must pass 100% green without regression.
  * **Validation/Test Location**: `npm run test`

- [x] T005 Add core repository state transition tests in src/core/__tests__/repositories.test.ts
  * **Target Files**: [src/core/__tests__/repositories.test.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/__tests__/repositories.test.ts)
  * **Expected Behavior**: Assert that performing a state transition writes exactly one `work_item.state_changed` event into the `events` table and updates `work_items.state`, `closed_reason`, and `updated_at`. Verify rollback behavior on failure.
  * **Constraints**: Ensure database remains clean after failed transition attempts.
  * **Validation/Test Location**: `npm run test`

---

## Phase 03: Unified State API & Endpoint Cleanup (Priority: P1)

**Purpose**: Create `PATCH /api/work-items/[id]/state` returning 200 OK or 422 Unprocessable Entity, and remove legacy `/api/work-items/[id]/drop/route.ts`.

- [x] T006 Create state transition API route in src/app/api/work-items/[id]/state/route.ts
  * **Target Files**: `src/app/api/work-items/[id]/state/route.ts`
  * **Expected Behavior**: Handle `PATCH` requests with body `{ project: string, state: "parked | active | blocked | closed", closed_reason?: string }`, matching the `project`-in-body convention used by `PATCH /api/work-items/[id]` and the removed `POST /api/work-items/[id]/drop`. Resolve `project` via `listRegisteredProjects()` and open its database via `createRepositories({ dbPath, projectKey, projectPath })`, same as those sibling routes. Missing/non-string `project` returns `400 Bad Request` (`Missing required field: project`); unresolved `project` returns `404 Not Found`. Invoke `updateWorkItemState`. On success, return `200 OK` with updated `WorkItem`. On caught `IllegalStateTransitionError`, return `422 Unprocessable Entity` with body `{ error: err.message, from: err.from, to: err.to, allowed: err.allowed }`. On missing/invalid `state`, return `400 Bad Request`.
  * **Constraints**: Accept all 4 valid state tokens in request body syntax. Follow Next.js App Router route handler conventions.
  * **Validation/Test Location**: Add API tests in `src/app/api/work-items/__tests__/state.test.ts` and run `npm run test`.

- [x] T007 [P] Remove legacy drop endpoint and update API test suite
  * **Target Files**: `src/app/api/work-items/[id]/drop/route.ts` (delete), `src/app/api/work-items/__tests__/work-items.test.ts`
  * **Expected Behavior**: Delete `src/app/api/work-items/[id]/drop/route.ts`. Update work item test suite to replace any calls to `/drop` with calls to `/state` carrying `{ project, state: "closed", closed_reason: "dropped" }`.
  * **Constraints**: Hitting `/drop` must return `404 Not Found`.
  * **Validation/Test Location**: `npm run test`

---

## Phase 04: Status Chip Dropdown & Close Reason Modal (Priority: P1)

**Purpose**: Implement status chip hover dropdown with 6px top-padding bridge, and Close confirmation dialog.

- [x] T008 [US2] Implement StatusChipDropdown component and styling in src/components/StatusChipDropdown.tsx
  * **Match**: Design handoff `design_handoff_status_dropdown_quick_phrases/README.md#1-status-chip-dropdown` and prototype `Minna Prototype.dc.html#statusActions`.
  * **Target Files**: `src/components/StatusChipDropdown.tsx`, [src/app/globals.css](file:///D:/Alvin/_CodeProjects/Project_Minna/src/app/globals.css)
  * **Expected Behavior**: Render hover dropdown container below `.journal-status` chip. Include a 6px `padding-top` bridge inside the dropdown wrapper to prevent mouse-leave flickering. Dropdown lists only legal operator actions: `parked` -> Close; `active`/`blocked` -> Pause, Close; `closed` -> none. Menu items styled with `padding: 8px 10px`, `font: 500 12px 'JetBrains Mono'`, hover background `#f3f5f4`.
  * **Breakpoints/Checkpoints**: Desktop display (min-width 110px dropdown).
  * **Translation Note**: Lift CSS styles from prototype lines 17-31 in README.md.
  * **Provenance**: Lifted from design prototype.
  * **Done when**: Dropdown opens on hover, mouse-over bridge prevents closing, clicking action executes callback, `closed` status shows no dropdown.
  * **Validation/Test Location**: `npm run dev` visual check.

- [x] T009 [US3] Create CloseReasonModal component and remove DropConfirmModal
  * **Target Files**: `src/components/CloseReasonModal.tsx`, [src/components/DropConfirmModal.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/DropConfirmModal.tsx) (delete)
  * **Expected Behavior**: Implement `CloseReasonModal` prompting the operator to choose a `closed_reason`: `done`, `dropped`, or `failed`. Include radio/button selector and Confirm / Cancel actions. Delete `DropConfirmModal.tsx`.
  * **Constraints**: Accessibility focus trapping via `useModalFocus`.
  * **Validation/Test Location**: `npm run build:cli`

- [x] T010 [US2] [US3] Integrate status chip dropdown and Close modal into CenterPanel and WorkspaceProvider
  * **Target Files**: [src/components/CenterPanel.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/CenterPanel.tsx), [src/components/WorkspaceProvider.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/WorkspaceProvider.tsx)
  * **Expected Behavior**: Wire `StatusChipDropdown` to status chip in `CenterPanel.tsx`. Update `WorkspaceProvider.tsx` context with `transitionFeatureState(featureId, nextState, closedReason?)`. When operator clicks "Pause", execute transition to `parked`. When operator clicks "Close", open `CloseReasonModal`. On confirmation, execute transition to `closed` with chosen reason.
  * **Constraints**: Do not force state changes on hover alone.
  * **Validation/Test Location**: `npm run test`

---

## Phase 05: Quick Phrases Bar & Compose Bar Polish (Priority: P1)

**Purpose**: Implement QuickPhrasesBar rendered ONLY for `parked` state ("Start this feature."), and enlarge compose textarea (2 rows) and Send button (56x56).

- [x] T011 [US1] Implement QuickPhrasesBar component in src/components/QuickPhrasesBar.tsx
  * **Match**: Design handoff `design_handoff_status_dropdown_quick_phrases/README.md#2-quick-phrases-bar` and prototype `Minna Prototype.dc.html#quickPhrases`.
  * **Target Files**: `src/components/QuickPhrasesBar.tsx`, [src/app/globals.css](file:///D:/Alvin/_CodeProjects/Project_Minna/src/app/globals.css)
  * **Expected Behavior**: Render quick phrases bar above compose bar **ONLY** when work item state is `parked`, rendering single chip "Start this feature.". Explicitly do NOT render freeform quick phrases for `active`, `blocked`, or `closed` states in Feature 005 per brief lines 104-111. Chips styled with `border: 1px solid #dbe0dd`, `border-radius: 6px`, `padding: 7px 12px`, `font: 500 12px 'JetBrains Mono'`. Hover background `#00F0FF`, text `#101614`. Implement horizontal scroll and 22px circular overflow chevrons mounted only when scroll is available in that direction.
  * **Translation Note**: Compute chip positions using `getBoundingClientRect` relative to scroll container as specified in design README line 38.
  * **Provenance**: Lifted from design prototype.
  * **Done when**: Rendered only for `parked` state; "Start" chip triggers action; non-parked states render no quick phrases bar.
  * **Validation/Test Location**: `npm run dev` visual check.

- [x] T012 Update compose bar textarea and send button in CenterPanel.tsx and globals.css
  * **Match**: Design handoff `design_handoff_status_dropdown_quick_phrases/README.md#3-compose-bar-updated`.
  * **Target Files**: [src/components/CenterPanel.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/CenterPanel.tsx), [src/app/globals.css](file:///D:/Alvin/_CodeProjects/Project_Minna/src/app/globals.css)
  * **Expected Behavior**: Update compose input from single-line `<input>` to 2-row `<textarea rows={2} resize="none">`. Update Send button from 40x40 to 56x56 square (`border-radius: 4px`, background `#00c9d6`, hover `#00F0FF`) with 24x24 icon. Remove compose bar top border/padding when quick phrases bar is present.
  * **Constraints**: `Enter` sends reply; `Shift+Enter` inserts newline.
  * **Validation/Test Location**: `npm run test`

- [x] T013 [US1] Wire Start quick phrase action in CenterPanel.tsx and WorkspaceProvider.tsx
  * **Target Files**: [src/components/CenterPanel.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/CenterPanel.tsx), [src/components/WorkspaceProvider.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/WorkspaceProvider.tsx)
  * **Expected Behavior**: When operator clicks "Start" quick phrase chip for a `parked` work item, invoke `transitionFeatureState(activeFeature.id, "active")`. Verify status chip updates to `active` and timeline renders single `work_item.state_changed` event bubble.
  * **Constraints**: "Start" quick phrase is rendered ONLY when work item state is `parked`.
  * **Validation/Test Location**: `npm run test`

---

## Phase 06: Component Integration & RTL Tests (Priority: P1)

**Purpose**: Validate complete end-to-end component interactions via React Testing Library.

- [x] T014 Add CenterPanel state transition tests in src/components/__tests__/CenterPanelState.test.tsx
  * **Target Files**: `src/components/__tests__/CenterPanelState.test.tsx`
  * **Expected Behavior**: RTL tests testing:
    1. "Start" quick phrase rendered for `parked` item; clicking it transitions state to `active`.
    2. Status chip hover reveals legal actions (Pause, Close).
    3. Selecting "Close" opens `CloseReasonModal`; picking `done` and confirming sets state to `closed` with `closed_reason: "done"`.
    4. `closed` work item displays non-interactive status chip with no dropdown and no quick phrases bar.
  * **Constraints**: All user stories (US1, US2, US3, US4) verified green in RTL test runner.
  * **Validation/Test Location**: `npm run test`

---

## Phase 07: Release Prep

**Purpose**: Execute mandatory release preparation per Constitution Article VIII.

- [x] T015 Perform version bump, CHANGELOG entry, and roadmap updates
  * **Target Files**: [package.json](file:///D:/Alvin/_CodeProjects/Project_Minna/package.json), [package-lock.json](file:///D:/Alvin/_CodeProjects/Project_Minna/package-lock.json), [CHANGELOG.md](file:///D:/Alvin/_CodeProjects/Project_Minna/CHANGELOG.md), [docs/feature_roadmap.md](file:///D:/Alvin/_CodeProjects/Project_Minna/docs/feature_roadmap.md)
  * **Expected Behavior**: Bump package versions, log Feature 005 completion in `CHANGELOG.md`, and add/mark row for `005-state-transitions` in `docs/feature_roadmap.md`.
  * **Constraints**: Version numbers must remain consistent across package files.
  * **Validation/Test Location**: File inspection.

---

## Phase 08: Browser Smoke Test

**Purpose**: Walk all user stories in a real browser against the build output.

- [ ] T016 Execute Browser Smoke Test for Feature 005 State Transitions
  * **Target Files**: `src/app/page.tsx` (running app in browser via `npm run dev`)
  * **Expected Behavior**: Walk through each user story independent test:
    1. **US1 (Start)**: Open a `parked` work item. Click "Start" quick phrase. Verify state becomes `active` (`#00F0FF`), phrase disappears, timeline shows transition.
    2. **US2 (Status Dropdown)**: Hover status chip on `active` item. Verify Pause & Close appear. Click Pause — state becomes `parked`.
    3. **US3 (Close Modal)**: Click Close on status dropdown. Pick `done` in CloseReasonModal. Verify item transitions to `closed` with `closed_reason: "done"`.
    4. **US4 (422 API Handling)**: Send illegal PATCH transition via curl/fetch. Confirm 422 status and structured payload.
  * **Constraints**: Must pass visually and functionally with zero console errors.
  * **Validation/Test Location**: Manual browser verification.
