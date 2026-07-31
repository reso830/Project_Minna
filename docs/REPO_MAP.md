# Repository Map

This document describes the structure and module layout of the Project Minna codebase, including the local database tracking mechanisms, web APIs, and React frontend components.

## Directory Layout

```text
Project_Minna/
  .specify/                 # Spec Kit memory files (constitution, system files)
  docs/                     # Architecture, features briefs, specifications, and roadmaps
    features/
      v1.0.0-minna-foundations/
        001-journal-view.md
        002-project-creation.md
    minna-project-registry.md
    REPO_MAP.md             # This file
    feature_roadmap.md      # Overall release roadmap tracker
  specs/                    # Spec Kit directories containing feature specs, plans, and checklists
    002-project-creation/
      spec.md
      plan.md
      tasks.md
      data-model.md
      contracts/
        api.md
        cli.md
      checklists/
        plan-review.md
      design/               # Design visual layout reference mockups
        error_modal_mockup.jpg
        sidebar_project_states_mockup.jpg
    003-work-item-management/
      spec.md
      plan.md
      tasks.md
      research.md
      data-model.md
      quickstart.md
      contracts/
        api.md
      checklists/
        requirements.md
        plan-review.md
  src/
    adapters/               # Third-party integration adapters
      claude.ts             # Claude LLM boundary
      codex.ts              # OpenAI Codex reviewer boundary
      github.ts             # GitHub PR/Issue API boundary
    app/                    # Next.js Application Root
      api/
        projects/           # Next.js API Routes for Project Management
          add/route.ts      # Validates, scaffolds, and registers projects
          open/route.ts     # Opens project scopes and updates last opened timestamps
          pick/route.ts     # Spawns OS-native directory picker dialogs
          route.ts          # Lists registered projects with disk availability flags
        work-items/         # Next.js API Routes for Work Item Management
          [id]/
            drop/route.ts   # Soft-drops/archives a work item
            route.ts        # Updates description and details brief files
          route.ts          # Lists and creates work items
      globals.css           # Main styling system variables, typography, and utility tokens
      layout.tsx
      page.tsx              # Main entry point for the three-panel Journal View workspace
    components/             # UI Components
      AddUpdateFeatureModal.tsx # Centered modal for creating and updating features
      AgentUsage.tsx        # Inline agent cost, quota, and runtime diagnostics bar
      CenterPanel.tsx       # Middle workspace timeline displaying event logs, decisions, and replies
      DiscardConfirmModal.tsx # Confirmation dialog for discarding dirty changes
      DropConfirmModal.tsx  # Confirmation dialog for soft-dropping a feature
      ErrorModal.tsx        # High-priority blocking dialog to render validation failures
      RightPanel.tsx        # Inspectable detail panel for active feature files and decisions
      Sidebar.tsx           # Navigation panel rendering projects, features, and operator details
      WorkspaceProvider.tsx # State provider managing selected projects, active features, and replies
      icons.tsx             # Shared SVGs for UI navigation and controls
    core/                   # Core Domain Logic & Persistence
      repositories/         # Repository abstraction and data access layer
        factory.ts          # Repository instantiation factory helper
        sqlite.ts           # SQLite concrete implementations
        types.ts            # Repository interface signatures
      db.ts                 # Local project event database helper (minna.db schema initialization)
      native-directory-picker.ts # OS-specific dialog picker subprocess commands (Darwin, Win32, Linux)
      project-context.ts    # Walks folder trees to resolve project scope contexts
      registry.ts           # Central SQLite project registry database helper (~/.minna/projects.db)
      speckit.ts            # Specifications path parser utility
      types.ts              # TypeScript interface contracts for types and workspaces
      work-item-model.ts    # Work items and decisions entity domain logic
      work-items.ts         # Projections retrieval from database events
    server/
      mcp.ts                # Model Context Protocol (MCP) server integration entry
      tools.ts              # MCP tool schema definitions and executors
    cli.ts                  # Local command-line interface entry for operators
```

## Core Modules & Roles

### 1. Global Registry (`src/core/registry.ts`)
Handles read/write transactions for the central project database at `~/.minna/projects.db`. Uses `PRAGMA journal_mode = WAL` and `BEGIN IMMEDIATE TRANSACTION` to serialize database access between the Next.js server and CLI processes. Re-exports JSON copies to `~/.minna/projects.json` for external inspections.

### 2. Context Resolver (`src/core/project-context.ts`)
Resolves target project scope contexts when executing operations. Traverses directories upwards searching for `.minna/config.yaml` or legacy `minna.project.yaml` and executes migrations automatically when legacy configs are encountered.

### 3. Folder Picker (`src/core/native-directory-picker.ts`)
Provides child process executors spawning platform-specific directory dialog selectors (Mac AppleScript, Windows PowerShell, Linux Zenity) without bringing in external dependencies.

### 4. API Endpoints (`src/app/api/projects/`)
Direct interface boundaries exposed to Next.js components to fetch recent projects, switch between active projects, and initialize new project scopes.

### 5. Event Journal & Projections (`src/core/db.ts`, `src/core/work-items.ts`)
`db.ts` manages the local SQLite database schema and constraints. `work-items.ts` contains the logic to query and construct feature and work-item state projections from the event journal.

### 6. Next.js Frontend Workspace
`page.tsx` and components under `src/components/` define the three-panel local-first web application. Communication is handled via Next.js routes and JSON payloads, completely sandboxable and usable offline.
