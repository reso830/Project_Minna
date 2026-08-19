# Implementation Plan: Details Panel

**Branch**: `004-details-panel` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/004-details-panel/spec.md` and design handoff `handoff/minna-details-panel.zip`

## Summary

This feature updates the Journal View (`CenterPanel.tsx`) by replacing the static feature details section with an expandable, on-demand **Details Panel** that opens on hover or can be pinned open via a control icon in the title bar. It also updates the title bar layout (54px height, assignee avatar, ID, slug, `margin-left: auto` spacer), preserves the always-visible feature brief recovery warning banner, and ensures feature slugs are displayed consistently in both the title bar and sidebar.

## Technical Context

**Language/Version**: TypeScript 5.x / Next.js 14+ (React 19)  
**Primary Dependencies**: Next.js (`next/image`), React (`useState`, `useRef`, `useLayoutEffect`, `useEffect`), CSS Modules / `globals.css`  
**Storage**: N/A for UI state; read-only from `WorkItem` projection in `WorkspaceProvider`  
**Testing**: Jest, React Testing Library (`src/components/__tests__/`)  
**Target Platform**: Modern Web Browsers (Desktop focused)  
**Project Type**: Next.js Web Application (`src/app/`, `src/components/`)  
**Performance Goals**: Instant UI hover response (<16ms frame time), zero 1-frame scroll flicker during reflow  
**Constraints**: Pure client-side component state for hover/pin behavior; no database or backend API schema changes; no external UI library dependencies  
**Scale/Scope**: 2 UI components (`CenterPanel.tsx`, `icons.tsx`), 1 CSS file (`globals.css`), 2 existing test files (`CenterPanel.test.tsx`, `CenterPanelWarnings.test.tsx`)  

## Constitution Check

*GATE: Must pass before Phase 0 research / Phase 1 design.*

- **Principle I (Human Authority)**: PASS. UI details inspection is read-only and does not automate decisions. User decision on conditional scroll-to-bottom alignment is authoritative.
- **Principle II & III (Deterministic State & Event Log as Source of Truth)**: PASS. Transient hover and pinned states are kept in local component memory. No database mutations or state transitions occur.
- **Principle IV (Thin Interfaces & Core Logic)**: PASS. `CenterPanel` remains a thin view consuming `activeFeature` from `WorkspaceProvider`.
- **Principle VI (Local-First, Inspectable State)**: PASS. Local client rendering with zero remote external dependencies.
- **Principle XII (Simplicity Before Scale)**: PASS. Practical React hooks (`useState`, `useRef`, `useLayoutEffect`) used without introducing third-party animation libraries or global state managers.
- **Principle XIII (Minna Owns Git; Subprocess Model)**: PASS. No git operations or state mutations performed by UI components.

### Constitution Compliance Note

- **Required-field impact**: N/A. No changes to data entity schemas (company, job title, status, last_status_update, responsibilities).
- **Centralized validation rules**: N/A. Displaying existing `WorkItem` metadata fields (`id`, `title`, `description`, `work_item_type`, `state`, `phase`, `assignee`).
- **Dependency justification**: No new npm dependencies introduced. Icons are implemented as inline SVG components in `src/components/icons.tsx`.

## Architecture & Data Flow

```text
[ WorkspaceProvider ]
        │
        ▼ (activeFeature: WorkItem)
┌────────────────────────────────────────────────────────────────────────┐
│ CenterPanel Component                                                  │
│                                                                        │
│  State & Refs:                                                         │
│    - isPinned: boolean                                                 │
│    - isHovered: boolean                                                │
│    - leaveTimerRef: NodeJS.Timeout | null                              │
│    - isAtBottomRef: React.MutableRefObject<boolean> (fresh snapshot)  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Title Bar Header (54px)                                          │  │
│  │  [Assignee Avatar] [ID] [Slug] --(margin-left: auto)-->           │  │
│  │  [Status] [Tasks] [DetailsToggleBtn]                             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                │                                       │
│  ┌─────────────────────────────┴────────────────────────────────────┐  │
│  │ Always-Visible Feature Brief Warning Banner                      │  │
│  │  (Rendered if activeFeature.feature_brief_missing is true)       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                │                                       │
│                                ▼ (onMouseEnter / onClick)              │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Details Panel (in normal document flow)                          │  │
│  │  Row 1: ID, Title (Slug)                                         │  │
│  │  Row 2: Type, Assignee (defaults to "Minna")                     │  │
│  │  Row 3: Description                                              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                │                                       │
│                                ▼ (useLayoutEffect & fresh isAtBottom) │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Journal Timeline (flex: 1, scrollable, onScroll listener)        │  │
│  │  Scrolled to bottom in useLayoutEffect if isAtBottomRef was true │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

1. **`src/components/icons.tsx`**:
   - Add `InfoIcon`: 15x15px stroke outline info circle (`<circle cx="12" cy="12" r="10" />...`).
   - Add `PinIcon`: 15x15px thumbtack icon (`<path d="M12 17v5" />...`).

2. **`src/components/CenterPanel.tsx`**:
   - Update helper: `assigneeLabel(feature)` returns `feature.assignee ?? "Minna"`.
   - Add local state & refs:
     - `isPinned` (`boolean`, initial `false`)
     - `isHovered` (`boolean`, initial `false`)
     - `leaveTimeoutRef` (`useRef<NodeJS.Timeout | null>(null)`)
     - `isAtBottomRef` (`useRef<boolean>(true)`)
   - Derived visibility: `const isDetailsVisible = isPinned || isHovered;`
   - Continuous & pre-transition scroll snapshot capture:
     - Helper `captureScrollState()`: `if (timelineRef.current) { isAtBottomRef.current = timelineRef.current.scrollTop + timelineRef.current.clientHeight >= timelineRef.current.scrollHeight - 5; }`.
     - Timeline `onScroll` handler: calls `captureScrollState()` continuously on scroll events.
   - Mouse handlers:
     - `handleMouseEnter`: Clear `leaveTimeoutRef` if active; call `captureScrollState()`; set `isHovered(true)`.
     - `handleMouseLeave`: Schedule `leaveTimeoutRef = setTimeout(() => { captureScrollState(); setIsHovered(false); }, 150)`. Calling `captureScrollState()` inside the timer callback immediately before setting `isHovered(false)` guarantees the scroll snapshot is 100% fresh even if the user scrolled up while the panel was open.
     - `handleTogglePin`: Call `captureScrollState()`. If `isPinned` is currently true (unpinning action), call `setIsPinned(false)` AND `setIsHovered(false)` to immediately close the panel even while pointer is over the button. If `isPinned` is false, call `setIsPinned(true)`.
   - Feature switch effect:
     - `useEffect` on `activeFeatureId`: Call `captureScrollState()`; reset `isPinned(false)`, `isHovered(false)`, and clear `leaveTimeoutRef`.
   - Scroll alignment layout effect:
     - `useLayoutEffect` listening to `isDetailsVisible`: If `isAtBottomRef.current` is true when `isDetailsVisible` changes, synchronously set `timelineRef.current.scrollTop = timelineRef.current.scrollHeight` prior to paint.
   - Header JSX update:
     - Avatar: 32x32px tile (`.journal-assignee-avatar`).
       - If `activeFeature.assignee` is `"minna"` or `null`/empty: Background `#00c9d6`, Image `/assets/Minna_White.png` (26x26px).
       - If agent (e.g. `"claude"`, `"codex"`): Predefined background color (`#e08a2e` for claude, `#4a544d` for codex, `#c0392b` for agy) with 2-letter uppercase code (e.g., "A1", "A2").
     - ID & Title: Numeric 3-digit ID in `#8f9a94` (`font: 14px 'JetBrains Mono'`) followed by `activeFeature.title` (slug) in `#0f1512` (`font: 600 17px 'JetBrains Mono'`).
     - Actions container (`.journal-header-actions`): Formatted with `margin-left: auto` spacer to right-align status chip, phase chip, and details toggle button.
     - Details toggle button: `22x22px` button. Renders `PinIcon` when `isDetailsVisible` is true; renders `InfoIcon` when false.
   - Feature Brief Warning Banner:
     - Rendered unconditionally directly below `<header>` if `activeFeature.feature_brief_missing` is true, ensuring recovery prompts are always visible outside the expandable details panel.
   - Details Panel JSX:
     - Rendered conditionally when `isDetailsVisible` is true directly below header/warning banner.
     - Container `className="details-panel"` with `onMouseEnter={handleMouseEnter}` and `onMouseLeave={handleMouseLeave}`.
     - Row 1: ID, Title (slug).
     - Row 2: Type (`activeFeature.work_item_type`), Assignee (`assigneeLabel(activeFeature)`).
     - Row 3: Description (`activeFeature.description`).

3. **`src/app/globals.css`**:
   - Update `.journal-header`: `flex: 0 0 54px`, `gap: 12px`, `padding: 0 24px`, `border-bottom: 2px solid var(--border)`, `align-items: center`.
   - Update `.journal-header-actions`: `margin-left: auto; display: flex; align-items: center; gap: 10px;`.
   - Add `.journal-assignee-avatar`: `width: 32px; height: 32px; border-radius: 6px; flex: 0 0 32px; display: flex; align-items: center; justify-content: center; overflow: hidden;`.
   - Add `.journal-details-toggle`: `width: 22px; height: 22px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #7c8983; cursor: pointer; border: 0; background: transparent; transition: background 0.15s, color 0.15s;`.
   - Add `.journal-details-toggle:hover`, `.journal-details-toggle--active`: `background: #7c8983; color: #eceff0;`.
   - Add `.details-panel`: `flex: none; background: #fff; border-bottom: 1px solid #dbe0dd; padding: 18px 24px; display: flex; flex-direction: column; gap: 16px;`.
   - Add `.details-panel-row`: `display: flex; gap: 32px;`.
   - Add `.details-panel-col`: `display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0;`.
   - Add `.details-panel-label`: `font: 600 11px 'JetBrains Mono'; color: #8f9a94; letter-spacing: .8px; text-transform: uppercase;`.
   - Add `.details-panel-value`: `font: 400 13px 'IBM Plex Sans'; color: #0f1512; line-height: 1.5;`.

## Project Structure & Affected Areas

### Affected Areas

#### Files to Modify
- `src/components/icons.tsx` — Add `InfoIcon` and `PinIcon` SVG components.
- `src/components/CenterPanel.tsx` — Refactor journal title bar header (add avatar, `margin-left: auto` spacer, details toggle button), preserve always-visible feature brief missing warning banner, replace static `feature-details` section with expandable Details Panel, implement hover/pin states, explicit unpin hover-clearing, continuous `onScroll` tracking, timer callback & feature-switch pre-transition scroll capture, and `useLayoutEffect` scroll adjustment.
- `src/app/globals.css` — Add CSS classes for Details Panel, title bar header updates (`margin-left: auto`), assignee avatar, and details toggle button.
- `src/components/__tests__/CenterPanel.test.tsx` (Existing file) — Update line 67 assertion from static details section text to expandable panel text when revealed/pinned; add unit tests for hover open/close, click pin/unpin (verifying unpin closes panel even while mouse is over button), feature switch reset, and both bottom-anchored and scrolled-up scroll position retention (including scrolling up while panel is open then closing via hover-leave timer).

#### Files to Inspect Only
- `src/components/__tests__/CenterPanelWarnings.test.tsx` (Existing file) — Verify that feature brief missing warning test continues to pass unconditionally.
- `src/components/Sidebar.tsx` — Confirm feature slug rendering (`feature.title`) and row layout.
- `src/core/types.ts` — Confirm `WorkItem` type properties (`id`, `title`, `description`, `work_item_type`, `assignee`, `state`, `phase`).
- `public/assets/Minna_White.png` — Confirm white Minna mark asset availability.

#### Out of Scope
- Database migrations or SQLite repository schema changes (`.minna/minna.db`).
- Editing feature metadata from the Details panel.
- RightPanel, AgentUsage, or composer modifications.

## Risks and Tradeoffs

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| Stale scroll snapshot during delayed hover-close | User scrolled up while panel was open gets forced to bottom when panel closes | Track scroll position continuously via `onScroll` and call `captureScrollState()` inside `setTimeout` callback immediately prior to setting `isHovered(false)`. |
| Unpin click leaves panel visible due to hover | Contradicts US2 Scenario 3 requirement | Explicitly call `setIsHovered(false)` alongside `setIsPinned(false)` on unpin toggle. |
| 1-frame visual scroll flicker on reflow | UI jank | Apply `scrollTop = scrollHeight` inside `useLayoutEffect` prior to paint. |
| Feature brief missing warning hidden behind collapsible panel | UX regression for recovery workflow | Render `.feature-brief-warning` outside the collapsible details panel directly below `<header>` so it remains always visible. |

## Validation Approach

1. **Automated Unit Tests**:
   - Run `npm test` to verify existing components pass without regression (including `CenterPanelWarnings.test.tsx`).
   - Execute updated `CenterPanel.test.tsx` test suite validating hover, pin, unpin while hovered, feature switch reset, and scroll retention (bottom-anchored, scrolled-up, and scrolled-up while open then closed via timer).
2. **Interactive UI Verification**:
   - Launch local dev server via `npm run dev`.
   - Test hover reveal & delayed close: Mouse over Details button -> panel expands -> scroll up while panel is open -> move mouse away -> panel closes after 150ms delay -> scroll position remains scrolled up (not forced to bottom).
   - Test pin toggle & unpin: Click Details button -> panel stays pinned when mouse leaves -> Click button again -> panel closes immediately even while mouse remains over button.
   - Test feature switch: Pin panel open -> select different feature in sidebar -> panel resets to closed.
   - Verify visually against design handoff spec (`54px` header, `#00c9d6` Minna avatar, `#8f9a94` ID, `#0f1512` slug, `margin-left: auto` controls).
