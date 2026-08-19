# Feature Specification: Details Panel

**Feature Branch**: `004-details-panel`
**Created**: 2026-08-18
**Status**: Draft
**Input**: [004-details-panel.md](file:///D:/Alvin/_CodeProjects/Project_Minna/docs/features/v1.0.0-minna-foundations/004-details-panel.md)

## Clarifications

### Session 2026-08-18

- **Q1**: What visual styling, avatar representation, color, or text label should be displayed in the Title Bar when a feature is unassigned (i.e. `assignee` is `null` or empty)?
  → **A**: Display Minna's assignee avatar (lightning blue `#00c9d6` background, centered white Minna mark icon `/assets/minna-white-icon.png`). Minna is the default assignee.
- **Q2**: When toggling the Details panel (hovering or pinning), should the chat thread always auto-scroll to the bottom? What if the user has scrolled up to inspect previous history—should it scroll them to the bottom, or only do so if they were already at the bottom?
  → **A**: Only auto-scroll to the bottom if the user's scroll position was already at the bottom prior to toggling. *(Note: This requirement design choice intentionally overrides the prototype's raw unconditional auto-scroll behavior to prevent scroll hijacking when an operator is reading earlier message history).*
- **Q3**: How should the assignee avatar's background color and 2-letter agent code be mapped for different assignees (e.g., from a static mapping or dynamically generated)?
  → **A**: Use a predefined static mapping in code for now (e.g., `'claude'` -> A1 / `#e08a2e`, `'codex'` -> A2 / `#4a544d`, etc.). This will be revisited later, including adding a more appropriate assignee images.

## Problem Statement

Currently, the Journal View displays the selected feature's title and status in a simple title bar, and its full metadata (ID, Title, Description, Type, State, Phase, Assignee) is statically displayed in a `Feature details` section directly under the header. This takes up constant vertical screen space, reducing the area available for the conversational journal and event timelines.

This feature replaces the static details block with an expandable **Details panel** that can be temporarily revealed on hover or pinned open. It also adds an Assignee avatar to the title bar and transitions feature naming from English titles to slugs in both the title bar and sidebar.

## Scope

### In Scope
- **Title Bar Update**:
  - Update the Journal View's title bar to be exactly 54px tall, horizontal flex, with `padding: 0 24px`, `gap: 12px`, bottom border `2px solid #dbe0dd`, and `align-items: center`.
  - Add an **Assignee avatar** (32x32px, `border-radius: 6px`) to the left of the feature ID + slug.
    - If assigned to "Minna" or unassigned (`null`/empty): background `#00c9d6` (lightning blue) with the white Minna mark icon (`/assets/Minna_White.png` or `/assets/minna-white-icon.png`) centered at 26x26px (`object-fit: contain`). Minna is the default assignee.
    - If assigned to an agent: solid background of the agent's placeholder color (predefined static mapping, e.g. `'claude'` -> `#e08a2e`, `'codex'` -> `#4a544d`, `'agy'` -> `#c0392b`), with a centered 2-letter agent code in white (`font: 700 11px 'JetBrains Mono'`).
  - Display the numeric ID in `#8f9a94` (`font: 14px 'JetBrains Mono'`, `margin-right: 8px`) followed by the feature **slug** (stored in `feature.title`) in `#0f1512` (`font: 600 17px 'JetBrains Mono'`).
  - Keep `.journal-header-actions` right-aligned using `margin-left: auto` spacer.
  - Keep the existing status chip.
  - Display the phase chip (e.g. "TASKS" or similar) with `border: 1px solid #dbe0dd`, `color: #4a544d`, `padding: 5px 14px`, `border-radius: 4px`, `font: 700 12px 'JetBrains Mono'`.
  - Add a **Details icon button** (22x22px, `border-radius: 6px`, color `#7c8983` at rest, hover background `#7c8983` and color `#eceff0`).
    - Icon default: outline "i" info icon (15x15px).
    - Icon active/pinned: star/badge pin icon (thumbtack shape, 15x15px).
- **Expandable Details Panel**:
  - Mount/reveal the panel under the title bar in the normal document flow (pushes the chat thread down, no absolute positioning or overlay).
  - Styling: Background `#fff`, bottom border `1px solid #dbe0dd`, `padding: 18px 24px`, vertical flex, `gap: 16px`.
  - Display 3 rows of metadata:
    1. **ID** (uppercase label, value: `font: 400 13px 'IBM Plex Sans'`) and **Title** (same format, showing the feature's slug/title).
    2. **Type** and **Assignee** (value: "Minna" or agent's name).
    3. **Description** (value `line-height: 1.5`, IBM Plex Sans).
  - Open temporarily on hovering the Details icon button or the Details panel itself. Close when mouse leaves both areas after a 150ms debounce buffer, unless pinned.
  - Toggling pinned state on clicking the Details icon button. When clicking to unpin, both pinned and hover states are cleared immediately so the panel closes cleanly even while the pointer remains on the button.
  - Per-thread scoping: Both hover and pinned states are local to the currently selected feature. Switching features resets the panel to hidden and unpinned.
- **Feature Brief Missing Warning Banner**:
  - If `feature_brief_missing` is true on the selected feature, an always-visible recovery warning banner (`.feature-brief-warning`) is rendered directly below `<header className="journal-header">` (above the expandable Details Panel), ensuring critical recovery prompts remain visible regardless of whether the Details Panel is open or closed.
- **Scroll Alignment**:
  - Scroll position state is tracked continuously and captured immediately before every visibility-changing transition (including hover enter, delayed 150ms mouse-leave timer callback execution, toggle button click, and feature-switch reset).
  - When the Details panel opens or closes, programmatically scroll the chat thread to the bottom ONLY if the user was actually at the bottom of the thread immediately prior to that specific transition.
- **Sidebar Naming**:
  - Show the feature **slug** (stored in `feature.title`) in the sidebar feature row instead of the English title.

### Non-Goals
- Editing or modifying feature metadata from the Details panel.
- Adding details panel configurations globally or persisting pinned states across different features.
- Changing the assignee, state, or phase from the details panel.
- General modifications to the RightPanel, composer, or timeline message rendering.

## User Scenarios & Testing

### User Story 1 - Hover to Expand Details (Priority: P1)
As an operator, I want to hover over the Details control to temporarily see the feature's metadata so that I can get context without cluttering my view.
* **Why this priority**: Core interaction for viewing feature details on-demand.
* **Independent Test**: Open a feature's journal view. Hover over the "i" Details button. Verify that the Details panel appears below the header, pushing the timeline down. Move the pointer over the panel itself and verify that it remains open. Move the pointer away from the panel and Details button. Verify that the panel closes after 150ms and the button reverts to the "i" icon.
* **Acceptance Scenarios**:
  1. **Given** the Details panel is closed, **When** the user hovers over the Details icon button, **Then** the Details panel opens and the button icon changes to a pin.
  2. **Given** the Details panel is open, **When** the user moves the pointer from the Details button to the Details panel, **Then** the panel remains open without flickering.
  3. **Given** the Details panel is open and unpinned, **When** the user's mouse leaves both the Details button and the Details panel, **Then** the panel closes after 150ms.

### User Story 2 - Pin Details Panel (Priority: P1)
As an operator, I want to click the Details control to pin the panel open so that I can keep the feature context visible while interacting with the thread.
* **Why this priority**: Essential for keeping details visible during longer sessions without having to hover continuously.
* **Independent Test**: Select a feature. Click the Details icon button. Verify that the Details panel opens and remains visible after moving the mouse away. Verify that the icon indicates the pinned state (pin icon). Click the Details icon button again while hovering over it. Verify that both pinned and hover states clear and the Details panel closes immediately.
* **Acceptance Scenarios**:
  1. **Given** the Details panel is closed or temporarily open, **When** the user clicks the Details icon button, **Then** the panel is pinned open, and the icon becomes a pin.
  2. **Given** the Details panel is pinned, **When** the user moves the mouse away, **Then** the panel stays open.
  3. **Given** the Details panel is pinned, **When** the user clicks the Details icon button to unpin, **Then** the panel is unpinned, hover state is cleared, and the panel closes immediately.

### User Story 3 - Per-Feature State Scoping (Priority: P1)
As an operator, I want the Details panel state to be scoped to each feature so that switching features doesn't carry over temporary or pinned panels.
* **Why this priority**: Prevents unwanted layout carry-over when navigating between different tasks.
* **Independent Test**: Pin the Details panel open on feature `001`. Select feature `002` from the sidebar. Verify that the Details panel for feature `002` starts closed. Switch back to feature `001`. Verify that the Details panel for `001` starts closed (both hover and pinned states are reset).
* **Acceptance Scenarios**:
  1. **Given** a feature has the Details panel pinned or hovered open, **When** the user selects a different feature from the sidebar, **Then** the new feature's Details panel is closed/unpinned, and the previous feature's Details panel state is cleared.

### User Story 4 - Layout Flow and Scroll Alignment (Priority: P2)
As an operator, I want the Details panel to push the chat thread down and keep the newest entry visible when toggling so that I don't lose track of the conversation.
* **Why this priority**: Ensures a seamless reading/writing flow and prevents the active message context from being obscured.
* **Independent Test**: Open a feature with enough messages to scroll. Toggle the Details panel open. Verify that the chat container shrinks but auto-scrolls to the bottom ONLY if the scroll position was already at the bottom.
* **Acceptance Scenarios**:
  1. **Given** the Details panel toggles open/closed, **When** the layout reflows and the user is scrolled to the bottom, **Then** the chat thread container automatically adjusts its size and triggers a programmatic scroll to the bottom of the container.
  2. **Given** the Details panel toggles open/closed, **When** the layout reflows and the user is scrolled up to view history (even if they scrolled up while the panel was open), **Then** the scroll position does not change programmatically when the panel closes or opens.

## Edge Cases
- **Flicker on Hover Transition**: Rapid hover transitions between the Details icon and the panel could cause visual flickering. A small 150ms debounce/delay on mouse-leave prevents this.
- **Unpin State Transition**: Clicking unpin while hovering on the button clears both `isPinned` and `isHovered` to prevent `isHovered` from keeping the panel open.
- **Delayed Close Scroll Stale Snapshot Prevention**: Scroll state is continuously tracked via `onScroll` and re-evaluated inside the 150ms timer callback and feature-switch reset prior to state changes, so scrolling up while the panel is open never results in a forced scroll to bottom when the panel closes.
- **Missing Brief Recovery Warning**: When a feature brief file is missing, the warning banner is rendered directly below the header in an always-visible state outside the collapsible details panel.
- **Missing or Long Metadata**:
  - If a metadata field (like description) is exceptionally long, it should wrap correctly without breaking columns.
  - If a field is `null` (e.g. no assignee), it displays "Minna".
- **Keyboard Navigation**: The Details control must be focusable and triggerable via Keyboard (`Enter`/`Space`) to pin/unpin.

## Data Considerations

### WorkItem Metadata
No database schema changes are required. The Details panel renders the following fields from the existing `WorkItem` object:
- `id`: Formatted as a 3-digit string (e.g. `"004"`).
- `title`: Renders the slug (e.g. `"details-panel"`).
- `description`: Renders the short text description (e.g. `"Add an expandable Details panel..."`).
- `work_item_type`: Renders the work item type (e.g., `"feature"`).
- `assignee`: Renders the assignee identifier (e.g., `"minna"`, `"claude"`, or `null` -> defaults to `"Minna"`).
