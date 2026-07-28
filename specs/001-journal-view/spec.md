# Feature Specification: Journal View

**Feature Branch**: `001-journal-view`  
**Created**: 2026-07-28  
**Status**: Draft  
**Input**: [001-journal-view.md](file:///D:/Alvin/_CodeProjects/Project_Minna/docs/features/v1.0.0-minna-foundations/001-journal-view.md)

## Clarifications

### Session 2026-07-28

- **Q**: Which frontend technology stack should be used, and where should its source code reside?  
  → **A**: A single Next.js app using TypeScript throughout, in a unified repository with a single root `package.json` (one thing to run).
- **Q**: Should we map the design's projects/features and journal/agent timelines directly to the existing [WorkItem](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts#L75) and [WorkItemEvent](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts#L121) schemas defined in [types.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts)?  
  → **A**: Yes. A "project" maps to the `project` string field, a "feature" maps to a [WorkItem](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts#L75) (where `work_item_type` is `"feature"`), and message bubbles/agent logs map to [WorkItemEvent](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts#L121) collections.
- **Q**: Which views need to be functional and fully modeled in this feature?  
  → **A**: Only the Journal View is implemented. The empty state represents the Journal View if it doesn't have any contents on it; it is not a separate view state. The Board View is not implemented.
- **Q**: Where should these session-persistent UI states (selected feature, resolved decisions, panel collapse states) be stored?  
  → **A**: In the browser's `sessionStorage` so that user interactions survive page reloads but clear when the browser session ends.
- **Q**: For the mock features, should their plan markdown and code diffs be bundled directly as static strings in the mock data file, or fetched dynamically as static assets?  
  → **A**: Bundled directly as static strings/objects within the frontend's mock data files.
- **Q**: Are the design handoff's exact color codes and typography sizes the final acceptance baseline?  
  → **A**: Yes. Because this is a greenfield UI with no pre-existing frontend design system, the handoff prototype's exact styles (hex values, font rules) serve as the authoritative baseline/source-of-truth.

## Problem Statement

Minna's primary interface model needs a high-fidelity, production-quality visual workspace. Up to this point, Minna has operated purely via the CLI and backend models. This feature builds the frontend foundation—the Journal View—using the approved design handoff as the source of truth, populated with representative mock data that conforms strictly to the [WorkItem](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts#L75) data structures. This establishes the UI wrapper and user experience baseline before backend services and live data persistence are integrated.

## Scope

### In scope

- **Single Next.js & TypeScript Application Structure**: Unified monorepo project configured via the root [package.json](file:///D:/Alvin/_CodeProjects/Project_Minna/package.json), allowing developer execution of both CLI and UI from a single unified workspace.
- **Left Sidebar**: 
  - Brand header displaying the logo mark and the "minna" wordmark in JetBrains Mono.
  - Collapsible scrollable Projects list populated with mock data (e.g. Checkout Redesign, Search Revamp, Billing v2, Notifications).
  - Feature rows displaying a status color dot (parked, active, blocked, closed), a 3-digit muted ID, and the feature slug.
  - Active hover states showing add-feature controls.
  - Collapsible Agent Usage tracker displaying 5h/7d usage progress bars.
- **Center Panel (Journal Timeline)**:
  - Header bar showing the selected feature slug, current status, and a mock "TASKS" outline button.
  - Scrollable message thread rendering custom avatars (color-coded, sender-initials), sender labels, timestamps, and message bubbles.
  - Interactive **Decision Prompts**: inline buttons for choice selections that resolve in-place, updating the bubble permanently during the session.
  - Footer composer with a text input and send button, submitting on click or Enter key.
  - Muted git info display line below the composer.
  - Empty state rendering within the Journal View when a selected feature has zero history.
- **Right Panel (Agent Detail)**:
  - Monospace, dark-themed (#0c110f) multi-tab pane (AGENTS, MD, DIFF).
  - AGENTS tab: independent, collapsible panes representing agent sub-processes, displaying formatted terminal command logs.
  - MD tab: renders the feature's active `plan.md` outline using a styled markdown bullet-list view.
  - DIFF tab: renders a unified code diff view with clear hunk headers (`@@`) and color-coded line modifications (green for additions, red for removals).
- **Session State Persistence**: State caching for active selections, resolved decisions, and accordion expansions within browser `sessionStorage`.

### Non-goals

- **Database integration or write-back**: This is a UI-only mock feature; no SQLite connection is established in the Next.js runtime.
- **Project or feature creation persistence**: Hovering or clicking sidebar "+" elements may trigger UI dialogs or actions, but no items are saved to disk.
- **Live agent or subprocess execution**: The terminal output in the AGENTS tab is fully static and mock-derived.
- **Board (Kanban) View**: The Board toggle is a placeholder and is not implemented.
- **Git integration**: The git branch info displayed below the composer is mocked.
- **Authentication or Multi-user support**: The workspace runs locally as a single-operator interface.

## User Behavior

1. **Expanding and Collapsing Projects**: Clicking a project row toggles the expanded state of its child features list. This operation modifies only the layout state and does not select a new feature.
2. **Selecting a Feature**: Clicking a feature row selects it, updating the active feature context. The Center Panel shifts to display the selected feature's journal events (or an empty state if none exist). The Right Panel updates its active tabs to show the specific plan markdown, diff contents, and agent logs of that selected feature.
3. **Submitting a Reply**: Typing text into the reply input and pressing Enter or clicking the Send button appends a new message representing the operator ("human") at the bottom of the timeline. This message persists for the duration of the browser tab session.
4. **Resolving Decision Prompts**: When a feature with a pending decision is loaded (e.g., "002 Payment retries"), the journal presents choice buttons. Clicking a choice replaces the buttons with a green checkmark pill indicating the selected choice, transitioning the parent feature status out of "blocked."
5. **Toggling Agent Detail Tabs**: Clicking AGENTS, MD, or DIFF tabs updates the active panel view. Clicking individual Agent panes inside the AGENTS tab collapses or expands their terminal consoles independently.

## Acceptance Criteria

### User Story 1 - Left Sidebar Project & Feature Navigation (Priority: P1)
Users can view projects and nested features, expand/collapse projects, and click on individual features to activate them in the workspace.
* **Why this priority**: Core navigation is required for any feature activity.
* **Independent Test**: Open the workspace browser view, expand the "Checkout Redesign" project, hover a feature to verify UI states, click "001 Cart drawer refactor", and assert that the main panels update to load its specific details.
* **Acceptance Scenarios**:
  1. **Given** the user is viewing the sidebar, **When** they click a collapsed project row, **Then** the list of features is revealed and the project row shows an expanded chevron indicator.
  2. **Given** the user hovers over a project row, **When** they hover, **Then** a "+" icon button appears on the right edge of the row.
  3. **Given** the features list is visible, **When** the user clicks a feature row, **Then** that feature becomes active, receiving the highlighted background color, and the center panel loads its events.

### User Story 2 - Journal Timeline & Empty State (Priority: P1)
The Journal View renders a chronological log of events (messages, system notes, git events) for the selected feature. If no events exist, a clean empty state is displayed.
* **Why this priority**: Verifying the message log layout and its support for empty states is essential for the core Minna interface.
* **Independent Test**: Toggle between an empty mock feature (e.g. a newly initialized mock feature) and an active feature with a rich timeline, asserting the layout transitions correctly without error.
* **Acceptance Scenarios**:
  1. **Given** a feature with no events is selected, **When** the Journal loads, **Then** it renders the empty-state layout with a placeholder prompt encouraging the user to initiate a task.
  2. **Given** an active feature is selected, **When** the Journal loads, **Then** it renders a scrollable list of messages matching the timeline events, showing initials avatars and aligned bubbles.

### User Story 3 - Decision Prompts (Priority: P2)
Decision prompts in the message thread offer interactive choices that resolve in-place, persisting the selection for the session.
* **Why this priority**: Proves interactive gate-resolution capability on the frontend.
* **Independent Test**: Click an option on a decision message, refresh the browser window, and confirm that the decision remains resolved with the chosen option visible and the feature status updated.
* **Acceptance Scenarios**:
  1. **Given** a message has a pending decision, **When** the user clicks one of the choice buttons, **Then** the buttons are replaced by a checkmarked text pill showing the selected choice.
  2. **Given** a decision is resolved, **When** the user reloads the tab, **Then** the resolved state is retrieved from `sessionStorage` and remains visible as resolved.

### User Story 4 - Message Composer (Priority: P2)
Operators can send text replies to features, appending them to the scrollable timeline.
* **Why this priority**: Interactive simulation of the human-operator write loop.
* **Independent Test**: Type a message, press Enter, verify it appends to the log, select a different feature, select the original feature again, and confirm the custom message is still at the bottom of the log.
* **Acceptance Scenarios**:
  1. **Given** the user focuses the reply input, **When** they type text and press Enter, **Then** the input is cleared and a new message block is appended to the bottom of the timeline containing the input text.
  2. **Given** a message has been appended, **When** the timeline is scroll-container overflows, **Then** it automatically scrolls to reveal the new bottom-most message.

### User Story 5 - Right Panel Details (Priority: P1)
The right-side agent panel displays collapsible terminal outputs, plan outlines, and unified code diffs.
* **Why this priority**: Essential workspace context for inspecting agent outputs.
* **Independent Test**: Toggle between the three tabs (AGENTS, MD, DIFF) on an active feature and assert that formatting matches the design handoff (color diff lines and monospace logs).
* **Acceptance Scenarios**:
  1. **Given** the Right Panel is in AGENTS mode, **When** the user clicks an agent header, **Then** the terminal log for that specific agent expands or collapses.
  2. **Given** the Right Panel is in MD mode, **When** loaded, **Then** it renders a formatted, readable monospace version of the plan outline.
  3. **Given** the Right Panel is in DIFF mode, **When** loaded, **Then** green background highlights additions (`+` lines) and red background highlights removals (`-` lines).

## Edge Cases

- **Large Log Message Threads**: The message timeline in the center panel must configure an overflow scroll viewport to prevent page-height blowout on long conversations.
- **Ultra-Wide Screens**: At widths above 1400px, the sidebar and right-side panels must maintain their fixed widths (280px and 490px respectively), with the center panel expanding horizontally to fill the fluid middle screen.
- **Special Characters in Markdown/Diffs**: Renders of mock code files or plan markdowns containing special characters must be properly escaped in the Next.js TSX elements to prevent compilation or rendering errors.
- **Missing Session Data**: If browser `sessionStorage` is empty or cleared, the application must fallback gracefully to default mock states without crashing.

## Data Considerations

The mock data layer will simulate projects and features strictly using the model schemas defined in [types.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts).

### Mock WorkItems
Mock feature records will represent instances of [WorkItem](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts#L75) matching the following shape:
- `id`: Globally unique identifier string (e.g., `"checkout-redesign-001"`), while maintaining a separate per-project display ID property.
- `title`: Short descriptive name of the feature (e.g., `"Cart drawer refactor"`)
- `description`: Plain-text feature brief summary
- `state`: Active workflow state (`"active" | "blocked" | "closed" | "parked"`)
- `phase`: Current roadmap step (`"spec" | "plan" | "tasks" | "implement" | "review" | "integrate"`)
- `project`: Project grouping string (e.g., `"Checkout Redesign"`)
- `created_at` & `updated_at`: ISO 8601 UTC timestamps

### Mock WorkItemEvents
The event logs will represent collections of [WorkItemEvent](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts#L121) models matching:
- `work_item_id`: Target unique feature ID association (e.g. `"checkout-redesign-001"`)
- `timestamp`: UTC timestamp string
- `actor`: `"human" | "minna" | "claude" | "codex" | "agy"`
- `type`: Structured type name (e.g., `"execution.started"`, `"agent.question"`, `"human.message"`)
- `summary`: Message text or description
- `payload`: Opaque JSON payload containing tab metadata:
  - `agents`: Monospace terminal line strings
  - `markdown`: Monospace plan markdown
  - `diff`: Monospace unified diff markup text
