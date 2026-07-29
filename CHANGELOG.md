# Changelog

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
