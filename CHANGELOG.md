# Changelog

## 0.2.0 — Event Journal

- Added the local SQLite event journal at `.minna/minna.db`, with append-only event triggers and same-transaction feature projections.
- Added `minna log`, `minna verify`, and `minna export` for inspecting, validating, and rendering journal history.
- Added the journal library API with an explicit SQLite connection context for feature creation and generic status updates; the feature projection is re-derived and checked against the event log.
- Disabled the legacy state-mutating CLI and MCP paths while their journal-backed replacements remain deferred.
