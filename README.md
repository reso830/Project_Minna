# Project_Minna

Project_Minna is a small orchestration layer for agent-assisted development workflows.

It is intended to sit beside target project repositories and coordinate Spec Kit-style phases, operator decisions, agent handoffs, GitHub metadata, and manual acceptance gates.

## Repository Shape

```text
Project_Minna/
  projects.yaml             # Target project registry
  policies.yaml             # Role and approval rules
  workflows/
    speckit-feature.yaml    # Feature lifecycle definition
  src/
    adapters/               # Codex, Claude, GitHub integration boundaries
    cli.ts                  # Local operator CLI
    core/                   # State, workflow, policy, project loading
    server/
      mcp.ts                # MCP tool surface
  state/                    # Local orchestrator state
```

## Initial Commands

```bash
npm install
npm run build
npm run start -- status
npm run start -- start-feature --project monica --title "Decision log"
npm run start -- serve-mcp
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
node .minna/dist/cli.js start-feature --title "Decision log"
```

Use [minna.project.example.yaml](./minna.project.example.yaml) as the starting point for target projects.

## Pilot Intent

The first target project should be small enough to reset and rich enough to exercise the full loop:

```text
specify -> clarify -> plan -> tasks -> implement -> test -> review -> manual_acceptance
```

`Project_Monica` is the recommended proving ground before using this orchestrator on a larger project.
