# Project_Minna

Project_Minna is a small orchestration layer for agent-assisted development workflows.

It is intended to sit beside target project repositories and coordinate Spec Kit-style phases, operator decisions, agent handoffs, GitHub metadata, and manual acceptance gates.

## Repository Shape

```text
Project_Minna/
  projects.example.yaml     # Template for target project registry
  projects.yaml             # Local target project registry, ignored by git
  policies.yaml             # Role and approval rules
  workflows/
    speckit-feature.yaml    # Feature lifecycle definition
  src/
    adapters/               # Codex, Claude, GitHub integration boundaries
    cli.ts                  # Local operator CLI
    core/                   # State, workflow, policy, project loading
    server/
      mcp.ts                # MCP tool surface
  .minna/                   # Local SQLite event journal (ignored by git)
```

## Initial Commands

```bash
npm install
cp projects.example.yaml projects.yaml
npm run build
npm run start -- status
npm run start -- log
npm run start -- verify
npm run start -- export --feature <id> ./specs/001-event-journal
```

## Project Modes

Minna supports two project resolution modes:

```text
Central mode:
  Project_Minna/projects.yaml maps many target projects.

Embedded mode:
  TargetProject/minna.project.yaml describes the current project.
  TargetProject/.minna/ can be a Git submodule pointing at Project_Minna.
```

In embedded mode, `--project` can be omitted:

```bash
cd D:/Alvin/_CodeProjects/Project_Monica
node .minna/dist/cli.js log
```

Use [minna.project.example.yaml](./minna.project.example.yaml) as the starting point for target projects.

## Scaffold Gaps

This first version intentionally leaves a few parts as explicit follow-up work:

- `policies.yaml` defines roles and gates, but enforcement is not wired yet.
- Workflow phases can be inspected, but phase advancement commands are still pending.
- The M1 source of truth is the local SQLite journal at `.minna/minna.db`; its
  `features` table is a projection of append-only events.
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
