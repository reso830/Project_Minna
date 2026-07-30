# Project_Minna

Project_Minna is a small orchestration layer for agent-assisted development workflows.

It is intended to sit beside target project repositories and coordinate Spec Kit-style phases, operator decisions, agent handoffs, GitHub metadata, and manual acceptance gates.

## Repository Shape

```text
Project_Minna/
  src/
    app/                    # Next.js App routes and API handlers
    components/             # UI components (Timeline, Sidebar, ErrorModal)
    adapters/               # Codex, Claude, GitHub integration boundaries
    cli.ts                  # Local operator CLI
    core/                   # Registry management, event journal, project loading
    server/
      mcp.ts                # MCP tool surface
  .minna/                   # Local SQLite event journal for this orchestrator (ignored by git)
  # Central project registry is stored globally at ~/.minna/projects.db
```

## Initial Commands

```bash
npm install
npm run dev                 # Start the Journal View at http://localhost:3000
npm run build               # Build the production Journal View
npm test
npm run build:cli
npm run start:cli -- status
npm run start:cli -- log
npm run start:cli -- verify
npm run start:cli -- export --feature <id> ./specs/001-event-journal
```

## Journal View Workspace

The Journal View is a local Next.js workspace backed by representative mock data;
it does not require a database, external API, or agent runtime.

```bash
npm run dev                 # Development UI at http://localhost:3000
npm run build && npm run start
npm run test:ui             # Jest + React Testing Library UI tests
```

The CLI remains available alongside the UI:

```bash
npm run build:cli
npm run dev:cli -- status
npm run start:cli -- status
```

## Testing and CI

The complete local suite is `npm test`. CLI unit tests use Node.js's built-in
`node:test` framework and UI tests use Jest with React Testing Library. After
building the CLI, run only its compiled unit tests with `npm run test:unit`.

GitHub Actions runs the build and unit-test commands for pull requests to
`main` and for pushes to `main`.

## Project Resolution & Registry

Minna resolves and scopes project execution context via a two-tier configuration system:

1. **Global Project Database Registry (`~/.minna/projects.db`)**:
   Tracks all registered and opened project scopes dynamically (with a read-only projection copy exported to `~/.minna/projects.json` for external inspections).
2. **Local Project Configuration & Event Journal**:
   Each tracked project maintains a `.minna/config.yaml` file (for version-controlled static metadata) and a `.minna/minna.db` SQLite event journal (local source of truth for work items, decisions, and feature states).

### Context Resolution

When invoking the CLI inside a directory, Minna automatically walks upwards through parent directories to locate the presence of `.minna/config.yaml` to resolve the current project scope.

Alternatively, developers can specify a free-text project label scope using the `--project <key>` flag verbatim:

```bash
# Explicit scoping
npm run start:cli -- status --project project-monica
```

Use the Add Project interface in the local web application at `http://localhost:3000` to register new project directories dynamically using the native folder picker. The Projects menu also supports registry-only rename, relocation, and removal; removal never deletes files from the project directory. Minna checks project health when listing projects and repairs a missing local `.minna/minna.db` when a healthy project is opened.

## Scaffold Gaps

This first version intentionally leaves a few parts as explicit follow-up work:

- Work-item transition legality (which phase/state changes are allowed) is not
  enforced yet; `start-feature`/`record-decision`/`record-manual-test` write
  directly.
- The M1 source of truth is the local SQLite journal at `.minna/minna.db`; its
  `features` and `work_items` tables are projections of append-only events.
- Concurrent SQLite writers are not yet handled; M1 is intentionally single-operator.

## Event Journal

The journal is initialized automatically by CLI commands and is the local authority
for M1 feature identity and generic status.

```bash
# Render the full event timeline or one feature's history
npm run start -- log
npm run start -- log --feature <id>

# Confirm the projection matches the append-only event log
npm run start -- verify

# Create a committable Markdown timeline at <dir>/journal.md
npm run start -- export --feature <id> <dir>
```

## Pilot Intent

The first target project should be small enough to reset and rich enough to exercise the full loop:

```text
specify -> clarify -> plan -> tasks -> implement -> test -> review -> manual_acceptance
```

`Project_Monica` is the recommended proving ground before using this orchestrator on a larger project.
