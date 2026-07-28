# Implementation Plan: Journal View

**Branch**: `001-journal-view` | **Date**: 2026-07-28 | **Spec**: [spec.md](file:///D:/Alvin/_CodeProjects/Project_Minna/specs/001-journal-view/spec.md)
**Input**: Feature specification from `/specs/001-journal-view/spec.md`

## Summary

This feature implements a Next.js (TypeScript) web interface for Minna's Journal View. Since the project is currently a Node.js CLI/MCP server, this plan configures a unified monorepo environment (one repository, one `package.json`, one thing to run). We will establish a mock data service conforming strictly to the [WorkItem](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts#L75) and [WorkItemEvent](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts#L121) types, build the multi-column workspace layout (Sidebar, Center Journal, Right Detail Panel), and implement session-level state persistence in `sessionStorage` (for selected features, resolved decisions, and console toggles). Database integration is completely out of scope, and the Board view is not implemented.

---

## Technical Context

* **Language/Version**: React v19, Next.js v15 (App Router), TypeScript. We will use Next.js with vanilla CSS as the styling baseline to match the design aesthetics.
* **Primary Dependencies**: `next`, `react`, `react-dom`, `@fontsource/jetbrains-mono`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` (to package and load fonts locally without network CDNs).
* **TypeScript Setup**: We will split tsconfig environments:
  - Root `tsconfig.json` handles Next.js App Router rules (needs JSX compilation, `.tsx` inclusion, `"bundler"` module resolution).
  - A new `tsconfig.cli.json` handles the Node.js CLI code, restricting inclusion to `src/**/*.ts` (excluding `.tsx`) with module/moduleResolution set to `"NodeNext"`.
  - Root `package.json` CLI build script will run `tsc -p tsconfig.cli.json` instead of the root tsconfig.
* **Storage**: Browser `sessionStorage` (for mock state duration).
* **Testing**: 
  - Jest, `jest-environment-jsdom`, and React Testing Library (RTL) for automated UI component testing. 
  - Built-in `node:test` for CLI unit testing.
  - Test scripts: `npm run test:unit` (CLI unit tests), `npm run test:ui` (Jest UI tests), and the root script `npm test` which compiles CLI modules and executes both suites (`npm run build:cli && npm run test:unit && npm run test:ui`).
  - CI Pipeline: Configured to compile CLI files (`npm run build:cli`), compile UI files (`npm run build`), and execute both test suites sequentially (`npm run test:unit` and `npm run test:ui`).
* **Target Platform**: Desktop browser at widths 1280px and above (fluid grid, fixed side panels).

---

## Constitution Check

This feature implements the visual shell for Minna while respecting core principles.

* **Principle I (Human Authority & Decision-Making)**: Recommendations are clearly marked, and decisions are resolved via manual human actions (interactive decision buttons).
* **Principle IV (Thin Interfaces & Core Logic)**: The Next.js frontend is a thin presentation wrapper. It renders mock data derived from the core TypeScript interfaces ([types.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts)).
* **Principle XII (Simplicity Before Scale)**: Unified single-repo structure using a single `package.json` to run. Minimal new packages are introduced.
* **Principle XIII (Subprocess Boundary)**: The frontend acts purely as a viewer. It does not run agents or perform git mutations locally.

**Centralized Validation & Required Fields**:
- The simulated feature profiles do not manage corporate/user profiles (company, job title, status, last_status_update, responsibilities). Consequently, these required fields are out of scope for the mock frontend layer.
- Mock features are checked against the [WorkItem](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts#L75) and [WorkItemEvent](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts#L121) types during development to ensure validation compliance before rendering.
- A new `"human.message"` event type will be added to the domain contract in [types.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts) to correctly type operator composer replies instead of abusing `"agent.note"`.
- Since this is a greenfield UI with no pre-existing frontend styling, the design handoff's exact colors (hex codes) and typography rules defined in the prototype README and CSS serve as the authoritative visual acceptance baseline. Typography is served offline via NPM-packaged self-hosted `@fontsource` modules.

---

## Project Structure

```text
specs/001-journal-view/
├── plan.md              # This file
├── research.md          # Technical choice and design decisions
├── data-model.md        # Mock data mapping and sessionStorage schema
├── quickstart.md        # CLI/API developer usage guide
├── contracts/           # UI state contract
│   └── api.md
└── checklists/
    └── plan-review.md   # Pre-implementation verification checklist
```

---

## Architecture and Data Flow

### Rendering Flow (Sidebar & Selected Feature Details)
```text
[Sidebar Project Row Hover] → Reveals "+" Add Icon
[Sidebar Feature Row Click] → Sets selectedFeatureId in Session State
         ↓
[Global State / Context] → Retrieves active WorkItem & WorkItemEvent List
         ↓
[Center Panel (Journal)] → Renders message bubble thread + composer
[Right Panel (Detail)]   → Renders active Tab (Agents logs, plan.md, unified diff)
```

### Interactive State Flow (composer reply & decisions)
```text
[Reply Input + Send] → Appends new WorkItemEvent (actor: "human") to sessionStorage
         ↓
[Update State]       → Timeline re-renders & scrolls to bottom

[Decision click]     → Saves resolved choice in sessionStorage
                     → Transitions WorkItem.state from "blocked" to "active"
                     → Replaces decision buttons with checkmark pill
```

---

## Affected Areas

### Files/Components likely to be Inspected
* [types.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts) (Verify data structures)

### Files/Components likely to be Modified
* [package.json](file:///D:/Alvin/_CodeProjects/Project_Minna/package.json) (Rename CLI commands to `build:cli`, `start:cli`, `dev:cli`; add Next.js `dev`, `build`, `start` scripts; add UI dependencies and Jest/RTL devDependencies)
* [tsconfig.json](file:///D:/Alvin/_CodeProjects/Project_Minna/tsconfig.json) (Rewrite root configuration to target Next.js App Router rules)
* [.github/workflows/ci.yml](file:///D:/Alvin/_CodeProjects/Project_Minna/.github/workflows/ci.yml) (Update build step to run `npm run build:cli` for unit tests and also run `npm run build` to verify UI compilation)
* [types.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts) (Add `"human.message"` to `WorkItemEventType`)

### New Files to be Added
* `tsconfig.cli.json` (TypeScript compilation target rules for CLI code)
* `jest.config.js` (Jest configuration settings for UI tests)
* `public/assets/minna-mark.png` (Tracked copy of the sidebar brand logo copied from design handoff)
* `src/app/` (Next.js application pages and layouts)
* `src/components/` (Sidebar, CenterPanel, RightPanel, AgentUsage, UI controls)
* `src/core/mockData.ts` (Mock data fixtures conforming to [WorkItem](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts#L75) schema using unique feature keys)
* `src/app/globals.css` (Base css style sheet carrying visual themes and custom font definitions)

### Tests likely to be Added or Updated
* `src/core/mockData.test.ts` (Validates mock data types against core types)
* `src/components/__tests__/` (Automated Jest/RTL unit and interaction tests for sidebar, timeline state changes, decision resolution persistence, and sessionStorage)

### Areas Explicitly Out of Scope
* `src/core/db.ts` (SQLite event journal is not integrated with the frontend)
* `src/cli.ts` (CLI remains a terminal-only command line wrapper)
* `src/server/mcp.ts` (MCP endpoints are not touched in this UI feature)

---

## Risks and Tradeoffs

* **Risk**: High dependency on browser `sessionStorage` means all progress is lost if the user closes the browser tab.
  - *Tradeoff/Mitigation*: This is acceptable for a UI-only feature that explicitly excludes backend persistence. It satisfies the "per session" mock persistence requirement.
* **Risk**: Styling drift from prototype.
  - *Tradeoff/Mitigation*: We will build a structured visual system using standard CSS variables mirroring the design tokens, preventing style fragmentations.

---

## Validation Approach

1. **Component & Layout Smoke Checks**:
   - Ensure the layout is responsive at resolutions of 1280px and wider, maintaining fixed widths for side panels and fluid sizing for the center timeline.
   - Assert all primary visual regions (Header, Sidebar, Timeline, Tab Panels) render cleanly.
2. **Interaction Verification**:
   - Toggle tabs in the Right Panel (AGENTS/MD/DIFF) and expand/collapse agent panels to assert correct console layouts.
   - Verify typing in the composer appends human timeline messages.
   - Click option choices on "002 Payment retries" decision prompt and assert that it updates to a resolved state.
3. **Data Integrity & Validation Checks**:
   - Run build and TypeScript compilation checks (`npm run build` and `npm run build:cli`) to ensure mock structures and CLI files compile cleanly.
4. **Automated UI Interaction Tests**:
   - Run `npm run test:ui` (Jest/RTL) to verify state updates.
   - Assert `sessionStorage` round-trips (saving replies and choices) execute correctly.
   - Assert decision prompt click interactions update feature statuses from `"blocked"` to `"active"` and toggle block reasons.
