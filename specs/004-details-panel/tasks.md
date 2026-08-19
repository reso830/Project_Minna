# Tasks: Details Panel

**Input**: Design documents from [specs/004-details-panel/](file:///D:/Alvin/_CodeProjects/Project_Minna/specs/004-details-panel/)
**Prerequisites**: [plan.md](file:///D:/Alvin/_CodeProjects/Project_Minna/specs/004-details-panel/plan.md) (required), [spec.md](file:///D:/Alvin/_CodeProjects/Project_Minna/specs/004-details-panel/spec.md) (required)

## Conventions Header

- **Status Legend**: `[x]` done · `[ ]` pending · `[~]` skipped
- **Parallel Execution**: Tasks marked `[P]` can run in parallel (different files, no shared edits)
- **Phase Dependency**: `Phase 01 → Phase 02 → Phase 03 → Phase 04 → Phase 05 → Phase 06 → Phase 07`
- **Verification Commands**:
  - `npm run test` (compiles CLI and runs unit and UI component tests)
  - `npm run dev` (starts Next.js development server for browser inspection)
  - `npm run lint` (runs ESLint checks)

### Phase Summary Table

| Phase | Name / Focus | Task ID Range | User Stories Covered |
| --- | --- | --- | --- |
| **01** | Setup & Icon Infrastructure | `T001–T002` | — |
| **02** | Title Bar Header & Assignee Avatars | `T003–T004` | US1 |
| **03** | Expandable Details Panel & Debounced Hover | `T005–T006` | US1, US2 |
| **04** | Per-Feature Scoping & Scroll Alignment | `T007–T009` | US3, US4 |
| **05** | Sidebar Slug Alignment & Styling Polish | `T010` | US1, US2, US3, US4 |
| **06** | Release Prep | `T011–T014` | — |
| **07** | Browser Smoke Test | `T015` | US1, US2, US3, US4 |

---

## Phase 01: Setup & Icon Infrastructure

**Purpose**: Export new SVG icon components required for the Details toggle (`InfoIcon` and `PinIcon`) and verify static asset paths.

- [ ] T001 [P] Add InfoIcon and PinIcon SVG components in src/components/icons.tsx
  * **Target Files**: [src/components/icons.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/icons.tsx)
  * **Expected Behavior**: Export `InfoIcon` (15x15px outline info circle SVG matching prototype line 318) and `PinIcon` (15x15px thumbtack SVG matching prototype line 315).
  * **Constraints**: Match SVG viewBox (`0 0 24 24`), stroke width (`2`), stroke-linecap (`round`), stroke-linejoin (`round`), and `currentColor` fill/stroke properties.
  * **Validation/Test Location**: Run `npm run build:cli` to verify compilation.

- [ ] T002 [P] Verify Minna white avatar asset in public/assets/
  * **Target Files**: `public/assets/Minna_White.png`
  * **Expected Behavior**: Ensure `Minna_White.png` is accessible at path `/assets/Minna_White.png` for Next.js Image component rendering.
  * **Constraints**: Preserve file dimensions and transparent background.
  * **Validation/Test Location**: File check / browser preview.

---

## Phase 02: Title Bar Header & Assignee Avatars (Priority: P1)

**Purpose**: Update the Journal View title bar in `CenterPanel.tsx` and `globals.css` to 54px height, rendering Assignee Avatar, 3-digit ID, feature slug, `margin-left: auto` spacer, status chip, phase chip, and Details toggle button.

- [ ] T003 [US1] Update CSS rules for journal header and assignee avatar in src/app/globals.css
  * **Target Files**: [src/app/globals.css](file:///D:/Alvin/_CodeProjects/Project_Minna/src/app/globals.css)
  * **Expected Behavior**: Update `.journal-header` to fixed 54px height (`flex: 0 0 54px`), `padding: 0 24px`, `gap: 12px`, `border-bottom: 2px solid var(--border)`, `align-items: center`. Update `.journal-header-actions` to include `margin-left: auto`. Add `.journal-assignee-avatar` (32x32px tile, `border-radius: 6px`, `#00c9d6` background for Minna/unassigned, or static agent color `#e08a2e`/`#4a544d`/`#c0392b`). Add `.journal-details-toggle` (22x22px button, `#7c8983` default color, hover background `#7c8983`, hover icon color `#eceff0`).
  * **Constraints**: Match design handoff tokens in `README.md` lines 14-28 and prototype lines 300-322.
  * **Validation/Test Location**: `npm run dev` visual check.

- [ ] T004 [US1] Refactor title bar header layout and assignee avatar rendering in src/components/CenterPanel.tsx
  * **Target Files**: [src/components/CenterPanel.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/CenterPanel.tsx)
  * **Expected Behavior**: Refactor the `<header className="journal-header">` section to render:
    1. Assignee Avatar (32x32px tile with `/assets/Minna_White.png` for `"minna"` or unassigned/null; solid color + 2-letter agent code for agents). Update `assigneeLabel` to return `feature.assignee ?? "Minna"`.
    2. Numeric 3-digit ID (`featureNumber(id)` in `#8f9a94`).
    3. Feature slug (`activeFeature.title` in `#0f1512`, `font: 600 17px 'JetBrains Mono'`).
    4. `.journal-header-actions` container (`margin-left: auto` spacer) containing status chip, phase chip ("TASKS" pill), and Details icon button (22x22px button rendering `InfoIcon` or `PinIcon`).
    5. Render `<p className="feature-brief-warning">` directly below `<header>` if `activeFeature.feature_brief_missing` is true, ensuring recovery prompts remain always visible outside the collapsible details panel.
  * **Constraints**: Do not modify timeline or composer layout.
  * **Validation/Test Location**: `npm run test`

---

## Phase 03: Expandable Details Panel & Debounced Hover (Priority: P1)

**Purpose**: Implement the expandable Details Panel component rendered in normal document flow below the header, with 150ms mouse-leave debounce and click-to-pin functionality with explicit hover clearing on unpin.

- [ ] T005 [US1] [US2] Add Details Panel styling in src/app/globals.css
  * **Target Files**: [src/app/globals.css](file:///D:/Alvin/_CodeProjects/Project_Minna/src/app/globals.css)
  * **Expected Behavior**: Add CSS rules for `.details-panel` (`flex: none; background: #fff; border-bottom: 1px solid #dbe0dd; padding: 18px 24px; display: flex; flex-direction: column; gap: 16px;`), `.details-panel-row` (`display: flex; gap: 32px;`), `.details-panel-col` (`display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0;`), `.details-panel-label` (`font: 600 11px 'JetBrains Mono'; color: #8f9a94; letter-spacing: .8px; text-transform: uppercase;`), and `.details-panel-value` (`font: 400 13px 'IBM Plex Sans'; color: #0f1512; line-height: 1.5;`).
  * **Constraints**: Match design handoff tokens in `README.md` lines 29-36 and prototype lines 324-350.
  * **Validation/Test Location**: `npm run dev` visual check.

- [ ] T006 [US1] [US2] Implement hover reveal, mouse-leave debounce, and pin toggle state in src/components/CenterPanel.tsx
  * **Target Files**: [src/components/CenterPanel.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/CenterPanel.tsx)
  * **Expected Behavior**:
    - Add component state in `CenterPanel.tsx`: `isPinned` (boolean), `isHovered` (boolean), and `leaveTimeoutRef` (`useRef<NodeJS.Timeout | null>(null)`).
    - Derive visibility: `const isDetailsVisible = isPinned || isHovered;`.
    - Implement `handleMouseEnter`: clear `leaveTimeoutRef` if active; set `isHovered(true)`.
    - Implement `handleMouseLeave`: schedule `leaveTimeoutRef = setTimeout(() => { captureScrollState(); setIsHovered(false); }, 150)`. Calling `captureScrollState()` inside the timer callback immediately before setting `isHovered(false)` guarantees the scroll snapshot is fresh even if the user scrolled up while the panel was open.
    - Implement `handleTogglePin`: if `isPinned` is true (unpinning), set `isPinned(false)` AND `setIsHovered(false)` so the panel closes immediately even while pointer is over the button. If `isPinned` is false (pinning), set `isPinned(true)`.
    - Render `<section aria-label="Feature details" className="details-panel">` conditionally directly below header/warning banner in normal document flow when `isDetailsVisible` is true.
    - Render 3 rows of metadata: Row 1 (ID, Title slug), Row 2 (Type, Assignee), Row 3 (Description).
    - Details icon button swaps icon: renders `PinIcon` when `isDetailsVisible` is true; renders `InfoIcon` when false.
  * **Constraints**: Attaching `handleMouseEnter` and `handleMouseLeave` to both the Details toggle button and the Details panel container ensures moving the pointer between button and panel does not flicker or close the panel. Explicitly clearing `isHovered` on unpin ensures clicking unpin closes the panel immediately as required by US2 Scenario 3.
  * **Validation/Test Location**: `npm run test`

---

## Phase 04: Per-Feature Scoping & Scroll Alignment (Priority: P1, P2)

**Purpose**: Ensure Details Panel state resets on feature navigation and layout reflow preserves scroll position at the bottom when user was already scrolled to bottom.

- [ ] T007 [US3] Implement per-feature state reset on feature switch in src/components/CenterPanel.tsx
  * **Target Files**: [src/components/CenterPanel.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/CenterPanel.tsx)
  * **Expected Behavior**: Add a `useEffect` hook listening to `activeFeatureId` changes that calls `captureScrollState()`, resets `isPinned` to `false`, `isHovered` to `false`, and clears any active `leaveTimeoutRef`.
  * **Constraints**: State must reset completely when selecting a different feature in the sidebar or changing projects.
  * **Validation/Test Location**: `npm run test`

- [ ] T008 [US4] Implement continuous onScroll tracking and pre-transition scroll capture in src/components/CenterPanel.tsx
  * **Target Files**: [src/components/CenterPanel.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/CenterPanel.tsx)
  * **Expected Behavior**:
    - Add `isAtBottomRef` (`useRef<boolean>(true)`).
    - Add helper `captureScrollState()`: `if (timelineRef.current) { isAtBottomRef.current = timelineRef.current.scrollTop + timelineRef.current.clientHeight >= timelineRef.current.scrollHeight - 5; }`.
    - Attach `onScroll={captureScrollState}` to `.journal-timeline`.
    - Also call `captureScrollState()` immediately prior to state mutations inside `handleMouseEnter`, `handleTogglePin`, the 150ms `leaveTimeoutRef` timer callback, and the `activeFeatureId` `useEffect` hook.
    - Add a `useLayoutEffect` listening to `isDetailsVisible` that programmatically sets `timelineRef.current.scrollTop = timelineRef.current.scrollHeight` prior to paint ONLY if `isAtBottomRef.current` was true.
  * **Constraints**: Prevents stale scroll snapshots during delayed hover-close or feature-switch resets, eliminating forced scrolls to bottom when user scrolled up while the panel was open.
  * **Validation/Test Location**: `npm run test`

- [ ] T009 [US1] [US2] [US3] [US4] Update existing CenterPanel test suite in src/components/__tests__/CenterPanel.test.tsx
  * **Target Files**: [src/components/__tests__/CenterPanel.test.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/__tests__/CenterPanel.test.tsx) (Existing file)
  * **Expected Behavior**:
    - Update existing test on line 67 ("shows the selected feature metadata separately...") to verify `screen.getByText("active", { selector: ".journal-status" })` and verify that the new expandable Details Panel (or toggle button) renders.
    - Add new unit test cases:
      1. Hovering Details button expands panel; mouse-leave closes panel after 150ms delay.
      2. Clicking Details button pins panel open; mouse-leave maintains open state.
      3. Clicking pinned Details button unpins and closes panel immediately (verifying unpin works while pointer is on button).
      4. Navigating to another feature resets pinned and hover states.
      5. Scroll position retention: verify timeline remains scrolled to bottom when anchored at bottom, and remains untouched when scrolled up (including when scrolling up while panel is open then closing via hover timer).
      6. Minna and Agent assignee avatar rendering.
    - Ensure `src/components/__tests__/CenterPanelWarnings.test.tsx` passes without regression.
  * **Validation/Test Location**: Run `npm run test` and verify all unit tests pass cleanly.

---

## Phase 05: Sidebar Slug Alignment & Styling Polish

**Purpose**: Audit and verify sidebar feature row rendering (`Sidebar.tsx`) to ensure feature slugs (`feature.title`) are displayed consistently.

- [ ] T010 [US1] Verify and polish sidebar feature row slug rendering in src/components/Sidebar.tsx
  * **Target Files**: [src/components/Sidebar.tsx](file:///D:/Alvin/_CodeProjects/Project_Minna/src/components/Sidebar.tsx)
  * **Expected Behavior**: Confirm feature rows in sidebar render `feature.title` (slug) in `#0f1512` with 3-digit ID in `#8f9a94`.
  * **Constraints**: Preserve existing hover pencil actions and status dot indicators.
  * **Validation/Test Location**: `npm run test` and visual check.

---

## Phase 06: Release Prep

**Purpose**: Version increments, CHANGELOG edits, and documentation roadmap updates.

- [x] T011 Bump package version to 0.7.0 in package.json and package-lock.json
  * **Target Files**:
    - [package.json](file:///D:/Alvin/_CodeProjects/Project_Minna/package.json)
    - `package-lock.json`
  * **Expected Behavior**: Update root version string to `0.7.0` in both `package.json` and `package-lock.json`.
  * **Validation/Test Location**: Run `npm run build:cli` to verify package compilation.

- [x] T012 Update CHANGELOG.md with Feature 004 details
  * **Target Files**: [CHANGELOG.md](file:///D:/Alvin/_CodeProjects/Project_Minna/CHANGELOG.md)
  * **Expected Behavior**: Add `[0.7.0]` entry documenting the expandable Details Panel, title bar redesign, assignee avatars, debounced hover, unpin hover-clearing, pre-transition scroll capture, and slug naming alignment.
  * **Validation/Test Location**: Manual markdown review.

- [x] T013 Update Feature Roadmap in docs/feature_roadmap.md
  * **Target Files**: [docs/feature_roadmap.md](file:///D:/Alvin/_CodeProjects/Project_Minna/docs/feature_roadmap.md)
  * **Expected Behavior**: Insert row for `004-details-panel`, release `0.7.0`, status `Completed`, and summary.
  * **Validation/Test Location**: Verify markdown table rendering.

- [x] T014 Update README.md and REPO_MAP.md
  * **Target Files**:
    - [README.md](file:///D:/Alvin/_CodeProjects/Project_Minna/README.md)
    - [docs/REPO_MAP.md](file:///D:/Alvin/_CodeProjects/Project_Minna/docs/REPO_MAP.md)
  * **Expected Behavior**: Update `README.md` UI features list and `docs/REPO_MAP.md` with new icon components and Details Panel structure.
  * **Validation/Test Location**: Manual documentation review.

---

## Phase 07: Browser Smoke Test (UI Features Only)

**Purpose**: Perform browser end-to-end smoke verification walking through all 4 User Stories against the to-be-merged build state.

- [ ] T015 Execute Browser Smoke Test for Feature 004
  * **Target Component**: Journal View Details Panel & Title Bar
  * **Expected Behavior**: Run `npm run build` and `npm run dev`, open browser at `http://localhost:3000`, and execute independent tests for:
    1. **US1 (Hover to Expand)**: Hover over "i" button -> panel expands -> move mouse into panel -> stays open -> move mouse away -> panel closes after 150ms.
    2. **US2 (Pin Details)**: Click Details button -> panel stays pinned when mouse leaves -> icon changes to pin -> Click again while hovering over button -> panel closes immediately.
    3. **US3 (Per-Feature Scoping)**: Pin panel open on feature 001 -> click feature 002 in sidebar -> panel starts closed for 002 -> switch back to 001 -> panel starts closed.
    4. **US4 (Scroll Alignment)**: Scroll to bottom of timeline -> open Details panel -> timeline reflows and remains scrolled to bottom -> scroll up to history while panel is open -> move mouse away -> panel closes after 150ms -> scroll position remains scrolled up (not forced to bottom).
    5. **Recovery Banner Check**: Select a feature with `feature_brief_missing` set to true -> verify warning banner is rendered directly below header in an always-visible state regardless of whether the Details Panel is open or closed.
