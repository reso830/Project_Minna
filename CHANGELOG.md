# Changelog

## 0.8.0 — State Transitions

- Added operator-triggered state transitions for work items within the Journal View.
- Added "Start" quick-phrase action rendered above composer for `parked` work items, executing `parked → active`.
- Added status chip hover dropdown with 6px top-padding bridge displaying legal operator actions (`parked`: Close; `active`/`blocked`: Pause, Close; `closed`: none).
- Added `CloseReasonModal` confirmation dialog prompting for `closed_reason` (`done` / `dropped` / `failed`), superseding and removing Feature 003's standalone `DropConfirmModal`.
- Added core 8-transition canonical matrix validation (`validateStateTransition` and `IllegalStateTransitionError`) in `src/core/work-item-model.ts`, bypassing validation on same-state phase/metadata updates.
- Added single `work_item.state_changed` event persistence written atomically with the `work_items` table update in SQLite.
- Added unified `PATCH /api/work-items/[id]/state` endpoint returning `200 OK` or `422 Unprocessable Entity` with structured `{ error, from, to, allowed }` payloads, and removed `/api/work-items/[id]/drop`.
- Added 2-row compose textarea (`rows={2}`) and enlarged 56x56 Send button in Journal View composer.

## 0.7.0 — Details Panel

- Added an expandable Details panel to the Journal View title bar displaying read-only metadata (ID, Title, Type, Assignee, Description) for the active feature.
- Added mouse-leave debounce (150ms) for temporary hover expansion and click-to-pin persistence with explicit hover clearing on unpin.
- Added per-feature state isolation so feature switching resets hover and pinned states to closed.
- Added continuous scroll tracking, pre-transition scroll capture, and layout reflow anchoring to keep the timeline positioned at the newest entry.
- Redesigned the Journal title bar header with 54px height, assignee avatar tiles (`Minna_White.png` or 2-letter agent badges), 3-digit ID formatting, and feature slug titles.
- Added `InfoIcon` and `PinIcon` SVG components in `src/components/icons.tsx`.
- Aligned sidebar feature row rendering for consistent feature slug and 3-digit ID displays.

## 0.6.0 — Work Item Management

- Added local project SQLite table schema migrations to support the work_items projection columns (closed_reason, feature_brief_path, spec_path, plan_path, tasks_path) and backfill the Events project column.
- Added a unified Repository pattern (IWorkItemsRepository, IEventsRepository) to cleanly isolate database reads/writes from the application controllers.
- Added sequential, project-scoped 3-digit ID generation that auto-increments and naturally expands to 4 digits if exceeding 999.
- Added Title slugification upon creation.
- Added a transaction-safe file-write and atomic recovery pipeline for creating and PATCH-updating details briefs with .tmp writing and automatic self-healing on read.
- Added UI details panel in the CenterPanel showing ID, Title, Description, Type, State, Phase, and Assignee, with warning banners for missing brief files.
- Added popover "+" buttons and hover edit pencil icons in the sidebar.
- Added Add/Update Feature, Discard Confirmation, and soft-drop confirmation modals to the sidebar workspace.
- Added unit and integration tests covering the new SQLite migrations, CLI start-feature commands, API routes, and modal components.

## 0.5.0 — Project Management Amendment

- Added Project Rename capabilities to modify the registered display name in the central database without altering local files.
- Added Project Relocate validation, which updates the registered folder path using the native OS directory selector and immediately rejects relocations to paths that are already registered or lack a valid `.minna/config.yaml`.
- Added Project Removal to safely deregister projects from the central registry projection while preserving all folder contents on disk.
- Added ongoing Project Health Checks to verify path existence and configuration schema validity on load, muting and disabling unavailable entries.
- Added lazy database self-healing for missing `.minna/minna.db` files on project open.
- Added a registry-scoped event history copy exported to `~/.minna/registry-events.json` on registry mutations.
- Added unit and integration tests covering path collision checks, lazy DB self-healing, popovers, modals, dirty-tracking save gates, and active project removal context resets.

## 0.4.0 — Project Creation

- Added the database-backed global project registry (`~/.minna/projects.db`) to track registered and opened project scopes.
- Added a Next.js server-side endpoint invoking native operating system folder pickers (AppleScript, PowerShell, Zenity) to select directories.
- Added local project directory validation, scaffolding (`.minna/config.yaml`), and lazy database creation for `.minna/minna.db`.
- Added a dedicated validation Error Modal to block invalid project imports and prevent auto-repair data corruption.
- Added project ID collision resolution by slugifying folder names and suffixing duplicate IDs sequentially (e.g., `-2`, `-3`).
- Added CLI context resolution traversal checks, legacy project configuration migration, and verbatim `--project` flag bypasses.

## 0.3.0 — Journal View

- Added the Next.js Journal View workspace with a three-panel layout for project navigation, journal timelines, and feature details.
- Added representative, domain-conforming mock data with session-persistent feature selections, replies, decision resolutions, and panel disclosures.
- Added Jest and React Testing Library coverage for sidebar navigation, timelines, composer validation, decisions, detail tabs, and accessibility relationships.
- Added separate UI and CLI commands so the web workspace and existing orchestration CLI can run side by side.

## 0.2.0 — Event Journal

- Added the local SQLite event journal at `.minna/minna.db`, with append-only event triggers and same-transaction feature projections.
- Added `minna log`, `minna verify`, and `minna export` for inspecting, validating, and rendering journal history.
- Added the journal library API with an explicit SQLite connection context for feature creation and generic status updates; the feature projection is re-derived and checked against the event log.
- Disabled the legacy state-mutating CLI and MCP paths while their journal-backed replacements remain deferred.
