# Research: Feature 005 State Transitions

## Key Technical Decisions & Analysis

### 1. Unified State Transition API vs Bespoke Endpoints

- **Problem**: Feature 003 implemented a standalone `/drop` endpoint to transition items to `closed_reason: dropped`. Feature 005 adds Start and Pause transitions, plus `done` and `failed` close reasons.
- **Decision**: Create a single `PATCH /api/work-items/[id]/state` endpoint and remove `/drop`. A unified endpoint ensures all transitions route through the canonical 8-transition validation matrix (`validateStateTransition`) and emit consistent single `work_item.state_changed` events.

### 2. Single Event Journal Pattern

- **Problem**: How should state transitions be logged in the event journal?
- **Decision**: Transitions write exactly one `work_item.state_changed` event (`from`, `to`, `blocked_reason`, `closed_reason`) with `actor: "human"` (or the calling actor) as mandated by the feature brief (lines 168-184) and canonical event model (`docs/minna-event-model.md`).

### 3. Status Dropdown Hover Bridge Design

- **Problem**: Moving the mouse cursor from the status chip to the dropdown menu can trigger an unwanted `mouseleave` event if a sub-pixel gap exists, causing the dropdown to flicker closed.
- **Decision**: The dropdown container includes a 6px invisible `padding-top` bridge inside the hoverable wrapper (`z-index: 30`). This creates a continuous hover boundary so the cursor never crosses empty space.

### 4. Structured Error Payloads (422 Unprocessable Entity)

- **Problem**: How should callers handle illegal state transitions?
- **Decision**: Returning HTTP 422 with `{ error, from, to, allowed }` provides machine-readable metadata. UI and CLI clients can inspect `allowed` directly to display or suggest valid alternative actions.
