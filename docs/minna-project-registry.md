# Minna Project Registry v3

## Description

Global registry of projects Minna knows about. Lives outside any single project, at
`~/.minna/projects.db` (SQLite). `project` fields on work items, events, and sessions resolve
against this registry's `id`.

A read-only JSON export is synchronized at `~/.minna/projects.json` for external tooling inspection, but this is a secondary projection and is never parsed by the application as the source of truth.

---

## Schema (Projections)

### Projects Table

| Field | Type | Description |
|---|---|---|
| `id` | TEXT PRIMARY KEY | registry key — what `project` fields elsewhere reference (slugified and lowercased, e.g. `project-celia`) |
| `name` | TEXT | display name (preserves exact folder casing on disk, e.g. `Project_Celia`) |
| `path` | TEXT UNIQUE | absolute path to the project's root on disk |
| `last_opened_at` | TEXT | ISO 8601 timestamp — updated on every open, including newly-scaffolded projects. Source of truth for the Recent Projects list (sort descending). |

### Events Table

Tracks the append-only event journal:
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `timestamp`: TEXT
- `actor`: TEXT
- `type`: TEXT (`project.registered`, `project.opened`, `project.renamed`, `project.relocated`, `project.removed`)
- `payload`: TEXT

A complete read-only JSON export of the events list is synchronized at `~/.minna/registry-events.json` on mutations.

---

## Revisions

- **v4** — expanded for Project Management, adding project rename, relocate path validation, registry-only removal, ongoing health checks, and lazy DB open repairs. Exports `~/.minna/registry-events.json` for full historical audit.
- **v3** — migrated to SQLite database backing (`projects.db`) with immediate write-locking to comply with core Constitution Principle III and VI.
- **v2** — added `last_opened_at`.
- **v1** — registry entry shape.