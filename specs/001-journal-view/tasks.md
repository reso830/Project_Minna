# Tasks: Journal View

## Conventions Header

- **Status Legend**: `[x]` done · `[ ]` pending · `[~]` skipped
- **Parallel Execution**: Tasks marked `[P]` can run in parallel (different files, no shared edits)
- **Phase Dependency**: `01 → 02 → 03 → 04 → 05 → 06 → 07`
- **Verification Commands**:
  - `npm run test` (compiles and runs typescript tests)
  - `npm run dev` (spins up Next.js client for manual check)

### Phase Summary Table

| Phase | Focus/Name | Task ID Range | User Stories Covered |
|---|---|---|---|
| **01** | Setup & Infrastructure | `T001–T003d` | — |
| **02** | Foundational Prerequisites | `T003c–T008` | — |
| **03** | Sidebar & Navigation | `T009–T010` | US1 |
| **04** | Journal Timeline & Feed | `T011–T013` | US2, US3, US4 |
| **05** | Right Detail Tab Panel | `T014` | US5 |
| **06** | Release Prep | `T015–T017` | — |
| **07** | Browser Smoke Test | `T018` | US1, US2, US3, US4, US5 |

---

## Phase 01: Setup (Shared Infrastructure)

**Purpose**: Configure Next.js environment and integrate dependencies within the unified package architecture.

- [x] **T001** **NPM Package & CI Configuration**
  * **Target Files**: [package.json](file:///D:/Alvin/_CodeProjects/Project_Minna/package.json), [.github/workflows/ci.yml](file:///D:/Alvin/_CodeProjects/Project_Minna/.github/workflows/ci.yml)
  * **Expected Behavior**: 
    - Add dependencies (`next`, `react`, `react-dom`, `@fontsource/jetbrains-mono`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`) and devDependencies (`@types/react`, `@types/react-dom`, `jest`, `jest-environment-jsdom`, `@testing-library/react`, `@testing-library/jest-dom`).
    - Add Next.js scripts: `"dev": "next dev"`, `"build": "next build"`, `"start": "next start"`.
    - Rename CLI scripts: `"dev:cli": "tsx src/cli.ts"`, `"build:cli": "npm run clean && tsc -p tsconfig.cli.json"`, `"start:cli": "node dist/cli.js"`.
    - Update root test script: `"test": "npm run build:cli && npm run test:unit && npm run test:ui"`.
    - Update CI configuration step 32-36: build CLI using `npm run build:cli`, build Next.js UI using `npm run build`, run CLI tests via `npm run test:unit`, and run Jest UI tests via `npm run test:ui`.
  * **Validation**: Run `npm install` and verify package compilation works.

- [x] **T002** [P] **TypeScript Setup**
  * **Target Files**: [tsconfig.json](file:///D:/Alvin/_CodeProjects/Project_Minna/tsconfig.json), `tsconfig.cli.json` (New file)
  * **Expected Behavior**: Reconfigure root `tsconfig.json` to target Next.js App Router rules (JSX, `.tsx` support). Create a new `tsconfig.cli.json` extending root but optimized for Node ESM CLI building, targeting `dist/` and excluding `.tsx`. Configure `build:cli` script to run `tsc -p tsconfig.cli.json`.
  * **Validation**: Verify that running `npm run build:cli` compiles CLI files without errors.

- [x] **T003** [P] **Design Artifact Materialization**
  * **Target Folder**: `handoff/minna-journal-view`
  * **Expected Behavior**: Extract `handoff/minna-journal-view.zip` into `handoff/minna-journal-view` working directory, so developers can inspect visual mockups and read style templates. Add extracted files to `.gitignore` to prevent tracking.
  * **Validation**: Directory `handoff/minna-journal-view/design_handoff_journal_view/Minna Prototype.dc.html` exists.

- [x] **T003b** **Next.js Config & Test Harness Setup**
  * **Target Files**: `next.config.mjs`, `jest.config.js` (New file)
  * **Expected Behavior**: Create Next.js configuration `next.config.mjs` and Jest configuration `jest.config.js`. Because `package.json` specifies `"type": "module"`, construct `jest.config.js` using ESM syntax (importing `next/jest.js` and using `export default`) to wrap configurations via `next/jest`, enabling Jest to leverage Next.js SWC compilation for `.ts/.tsx` files and preventing ESM module loading friction. Define the setup file to configure `@testing-library/jest-dom` and set the target environment to `jest-environment-jsdom`. Until Phase 02 creates `src/app`, `test:ui` exits successfully without invoking `next/jest`; afterward it invokes Jest normally.
  * **Validation**: Running `npm run test:ui` executes the test command without ESM loading or syntax parsing errors.

- [x] **T003d** **Brand Logo Asset Materialization**
  * **Target File**: `public/assets/minna-mark.png` (New file)
  * **Expected Behavior**: Copy the brand logo image `minna-mark.png` from `handoff/minna-journal-view/design_handoff_journal_view/assets/minna-mark.png` (extracted in T003) to `public/assets/minna-mark.png` in the tracked source files, ensuring it is tracked by Git.
  * **Validation**: The file exists at `public/assets/minna-mark.png` and `git status` reports it as an untracked file (not gitignored).

---

## Phase 02: Foundational (Blocking Prerequisites)

**Purpose**: Build mock data layers and base components/context providers before UI construction.
* **⚠️ CRITICAL**: No user story UI implementation can begin until this phase is complete.

- [x] **T003c** **WorkItemEventType Extension**
  * **Target File**: [types.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts)
  * **Expected Behavior**: Add `"human.message"` to the `LifecycleEventType` type definition so that human operator messages are typed properly in features logs.
  * **Validation**: Running `npm run build:cli` compiles the type file successfully.

- [x] **T004** **Conforming Mock Data Fixtures**
  * **Target File**: `src/core/mockData.ts` (New file)
  * **Expected Behavior**: Declare mock projects and features matching the design handoff datasets, structuring feature IDs using globally unique names (e.g. `checkout-redesign-001`) and timeline events typing composer replies to the `"human.message"` event type (depends on type definitions from T003c).
  * **Validation**: Compiles cleanly with TypeScript.

- [x] **T005** [P] **Global Style Sheet Initialization**
  * **Target File**: `src/app/globals.css` (New file)
  * **Expected Behavior**: Declare CSS variables matching the prototype design tokens (colors: `#f3f5f4` app background, `#eceff0` sidebar, `#0c110f` dark pane, `#00c9d6` accent). Import `@fontsource/jetbrains-mono`, `@fontsource/ibm-plex-sans`, and `@fontsource/ibm-plex-mono` at the top of the CSS file to load visual fonts locally, satisfying design typography rules with offline self-hosted packages.
  * **Validation**: File builds cleanly and contains the variable definitions and local font imports.

- [x] **T006** **UI State Provider Integration**
  * **Target File**: `src/components/WorkspaceProvider.tsx` (New file)
  * **Expected Behavior**: Implement React Context exposing active feature IDs, replies cache arrays, and resolved decision prompt mappings, keying all feature storage items under their globally unique feature IDs (e.g. `checkout-redesign-001`) and reading/writing from client `sessionStorage` in `useEffect` hooks.
  * **Validation**: Hook updates propagate values to child components.

- [x] **T007** **Layout Template Structure**
  * **Target Files**: `src/app/layout.tsx` (New file), `src/app/page.tsx` (New file)
  * **Expected Behavior**: Set up base Next.js HTML outline loading `globals.css` (which handles all styling and font imports), and structure the fluid three-column grid layout (Sidebar, Center Panel, Right Panel).
  * **Validation**: Page compiles and loads a skeleton view at `http://localhost:3000`.

- [x] **T008** **UI Interaction & Mock Data Verification Test**
  * **Target Files**: `src/core/mockData.test.ts` (New file), `src/components/__tests__/Workspace.test.tsx` (New file)
  * **Expected Behavior**: 
    - Write unit tests verifying that all mock records parse against the domain schemas (valid statuses including `"spec"`/`"integrate"`, dates, and non-null values).
    - Write automated Jest/RTL interaction tests verifying component rendering, active feature sessionStorage selections caching, and decision resolution state transitions.
  * **Validation**: Run `npm run test` (CLI tests) and `npm run test:ui` (Jest/RTL UI tests) and assert all pass.

---

## Phase 03: User Story 1 - Left Sidebar Layout & Navigation (Priority: P1)

**Goal**: Render the projects/features list and agent usage tracker inside the left sidebar.
* **Independent Test**: Click sidebar projects to expand, click feature rows, and assert selections update successfully.

- [x] **T009** **Sidebar Projects & Features UI**
  * **Target File**: `src/components/Sidebar.tsx` (New file)
  * **Visual-Fidelity**: 
    - **Match**: `handoff/minna-journal-view/design_handoff_journal_view/Minna Prototype.dc.html#L23-L160`
    - **Breakpoints**: 1280px and above.
    - **Translation Note**: Render layout using standard flex/grid spacing and font rules matching the prototype. Include active selection indicator (`#00F0FF` background) and hover state reveal logic for "+" icons. Render logo image from `/assets/minna-mark.png` (materialized in T003d).
    - **Provenance**: `recreated manually` to align clean CSS styling conventions in React.
  * **Done when**: Sidebar renders identically to prototype and project/feature selection updates active states. Automated Jest test `Sidebar.test.tsx` passes.

- [x] **T010** [P] **Agent Usage Section**
  * **Target File**: `src/components/AgentUsage.tsx` (New file)
  * **Expected Behavior**: Implement collapsible Agent Usage component as a separate component file (subsequently imported and rendered in `src/components/Sidebar.tsx` to prevent shared file write conflicts), displaying progress bars showing 5h/7d usage metrics filled with color `#00c9d6` on a `#dfe6e2` background track.
  * **Validation**: Expand/collapse toggle operates independently, progress bars render correctly, and component integrates clean with Sidebar.

---

## Phase 04: User Story 2, 3 & 4 - Center Journal Panel & Timeline Feed (Priority: P1)

**Goal**: Implement the scrollable event timeline, composers, and interactive decision prompts.
* **Independent Test**: Open the timeline for a blocked feature, submit a composer response, and click a decision prompt option to resolve the block.

- [x] **T011** **Timeline Thread & Empty State**
  * **Target File**: `src/components/CenterPanel.tsx` (New file)
  * **Visual-Fidelity**:
    - **Match**: `handoff/minna-journal-view/design_handoff_journal_view/Minna Prototype.dc.html#L165-L215`
    - **Breakpoints**: 1280px and above.
    - **Translation Note**: Replicate bubble spacing, custom initials avatar colors (dark background/cyan text for Minna; orange for agents), and layout empty states for features with empty timelines.
    - **Provenance**: `recreated manually` to bind dynamic events list to rendering elements.
  * **Done when**: Messages render sequentially, scroll handles viewport overflow, and composer entries append custom human event blocks. Automated Jest test `CenterPanel.test.tsx` passes.

- [x] **T012** **Interactive Decision prompts**
  * **Target File**: `src/components/CenterPanel.tsx`
  * **Expected Behavior**: When a message contains a pending decision, render choice buttons. Click event registers the answer, updates the feature state status out of "blocked" in memory, and replaces choice buttons with a checkmark answer pill.
  * **Validation**: Click interactions successfully update the state and persist across reloads.

- [x] **T013** **Timeline Validations**
  * **Target File**: `src/components/CenterPanel.tsx`
  * **Expected Behavior**: Include validation logic in composer to block empty strings and verify ISO timestamps map to localized time layouts.
  * **Validation**: Submitting whitespace fails silently; timestamp displays match standard locale layout.

---

## Phase 05: User Story 5 - Right Detail Tab Panel (Priority: P1)

**Goal**: Build detail tabs for collapsible agent terminal logs, plan markdown, and unified diff files.
* **Independent Test**: Select "MD" or "DIFF" tabs to inspect plan files and unified diffs.

- [x] **T014** **Right Tab Panel UI**
  * **Target File**: `src/components/RightPanel.tsx` (New file)
  * **Visual-Fidelity**:
    - **Match**: `handoff/minna-journal-view/design_handoff_journal_view/Minna Prototype.dc.html#L216-L360`
    - **Breakpoints**: 1280px and above.
    - **Translation Note**: Port monospace layouts, red/green diff styles, and collapsible agent headers.
    - **Provenance**: `recreated manually` to map static payload texts onto React tab segments.
  * **Done when**: Displays correct diff formatting and toggling between tabs works seamlessly. Automated Jest test `RightPanel.test.tsx` passes.

---

## Phase 06: Release Prep

**Purpose**: Execute final checks, update version logs, and roadmap indexes.

- [x] **T015** [P] **Version Updates**
  * **Target Files**: [package.json](file:///D:/Alvin/_CodeProjects/Project_Minna/package.json), `package-lock.json`
  * **Expected Behavior**: Bump project revision fields to the release version (e.g. `0.2.1` or equivalent).
  * **Validation**: Run standard lint check on package formatting.

- [x] **T016** [P] **Changelog & Documentation Updates**
  * **Target Files**: `CHANGELOG.md`, `README.md`
  * **Expected Behavior**: Record additions and instructions for the new Next.js UI dev execution workspace.
  * **Validation**: Verify markdown formatting rendering.

- [x] **T017** **Feature Roadmap Update**
  * **Target File**: `docs/feature_roadmap.md` (New file if missing)
  * **Expected Behavior**: Create `docs/feature_roadmap.md` if it does not exist, populating it with Feature 001's details and marking its status row as completed/implemented.
  * **Validation**: File exists and lists `001-journal-view` as completed.

---

## Phase 07: Browser Smoke Test

**Purpose**: Validate full user journeys inside the browser against the release state.

- [x] **T018** **End-to-End User Journeys Verification**
  * **Target Component**: Whole UI surface
  * **Expected Behavior**: Spin up development client (`npm run dev`), launch browser window, and step through independent tests:
    1. Navigate projects list and verify panel swaps on feature select.
    2. Add comments in the timeline, verify composer updates and page scrolling.
    3. Click choice prompts on Payment Retries, verify decision block resolves.
    4. Click MD/DIFF tabs, expand agent console toggles, verify colors and scroll.
  * **Validation**: Verify all actions operate smoothly in browser and save state correctly to sessionStorage.
