# Feature 000: State Model + CLI-Era Quarantine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quarantine the CLI-era prompt/roadmap surface behind the `v1-cli-era` tag, then implement the data shape (types + storage + pure derivations) for Minna's new four-state/seven-phase work-item model, exactly as specified in `minna-state-model-v0.md`, with no transition logic and no UI wiring.

**Architecture:** Task 1 is a deletion-only commit (git history + the `v1-cli-era` tag preserve everything). Task 2 extends `src/core/db.ts`'s existing SQLite journal (`.minna/minna.db`) — reusing the append-only `events` table (three new nullable columns) rather than a second journal — and adds a new `work_items` projection table. New code lives in three new files that separate pure logic from storage: `work-item-model.ts` (pure, no I/O — UI-safe), `work-items.ts` (SQLite CRUD, only two write paths touch the projection), `work-items.fixtures.ts` (seed data).

**Tech Stack:** TypeScript (NodeNext/ES2022, strict), `node:sqlite` (`DatabaseSync`), `node:test` + `node:assert/strict`, no new dependencies.

## Global Constraints

- Reuse the single `.minna/minna.db` journal — do not create a second database file (Constitution VI: one local SQLite event journal).
- Events table stays append-only (existing `prevent_event_update`/`prevent_event_delete` triggers apply unchanged to new columns/rows).
- No transition/validation logic beyond shape invariants (`blocked_reason` requires `state === "blocked"` and vice versa; `phase` must belong to the `work_item_type`'s sequence). Nothing decides *when* a work item should move — only two functions (`createWorkItem`, `updateWorkItemState`) ever touch the `work_items` projection, and both are direct, explicit, unchecked-for-legality writes.
- `phase_group` is never stored — always derived from `phase` on read via a pure function.
- Do not touch `src/core/state.ts`, `src/core/workflow.ts`, `src/core/types.ts`'s existing `PhaseId`/`WorkflowPhase`/`FeatureState`, or `workflows/speckit-feature.yaml` — `src/cli.ts` still imports them; superseding them is future feature work (per `docs/feature_roadmap.md`'s own disposition table, which this plan quarantines but whose judgment on this point still holds).
- Two separate commits: quarantine (Task 1), state-model implementation (Task 2). Never mixed.

---

### Task 1: Quarantine the CLI-era surface

**Files:**
- Delete: `scripts/prompts/minna-address-findings.md`, `minna-arch-review.md`, `minna-check-implementation.md`, `minna-check-requirements.md`, `minna-engr-review.md`, `minna-implement-phase.md`, `minna-plan.md`, `minna-pr-review.md`, `minna-rereview.md`, `minna-spec-review.md`, `minna-specify.md`, `minna-tasks.md` (12 files)
- Delete: `.claude/commands/minna-check-implementation.md`, `minna-check-requirements.md`, `minna-implement-phase.md`, `minna-plan.md`, `minna-pr-review.md`, `minna-spec-review.md`, `minna-specify.md`, `minna-tasks.md` (8 files)
- Delete: `docs/feature_roadmap.md`
- Delete: `docs/features/1.0.0-safety-net/001-event-journal.md`, `002-git-checkpoints.md`, `003-agent-run-wrapper.md` (confirmed in scope with the operator — same CLI-first "input to `/specify`" brief format as 001/002)

**Do not touch (confirmed with operator or explicitly protected by the brief):**
- `.agent/skills/speckit-*/SKILL.md` (8 files) — same CLI-era category, operator chose to leave in place, flag only.
- `src/core/state.ts`, `src/core/workflow.ts`, `src/core/types.ts` (`PhaseId`/`WorkflowPhase`/`FeatureState`), `workflows/speckit-feature.yaml` — operator chose to leave in place; `src/cli.ts` imports these directly, deleting would break the build.
- `.specify/memory/constitution.md` — flag only (see report below), do not rewrite.
- `docs/findings-contract.md` + `docs/findings-contract-schema.json` — keep as-is.
- `docs/conventions/review.md` — keep as-is.
- `src/core/db.ts` (001's journal) — audited in Task 2, reused, not deleted.

- [ ] **Step 1: Remove the CLI-era prompt/roadmap/brief files**

```bash
git rm scripts/prompts/minna-address-findings.md scripts/prompts/minna-arch-review.md scripts/prompts/minna-check-implementation.md scripts/prompts/minna-check-requirements.md scripts/prompts/minna-engr-review.md scripts/prompts/minna-implement-phase.md scripts/prompts/minna-plan.md scripts/prompts/minna-pr-review.md scripts/prompts/minna-rereview.md scripts/prompts/minna-spec-review.md scripts/prompts/minna-specify.md scripts/prompts/minna-tasks.md
git rm .claude/commands/minna-check-implementation.md .claude/commands/minna-check-requirements.md .claude/commands/minna-implement-phase.md .claude/commands/minna-plan.md .claude/commands/minna-pr-review.md .claude/commands/minna-spec-review.md .claude/commands/minna-specify.md .claude/commands/minna-tasks.md
git rm docs/feature_roadmap.md
git rm docs/features/1.0.0-safety-net/001-event-journal.md docs/features/1.0.0-safety-net/002-git-checkpoints.md docs/features/1.0.0-safety-net/003-agent-run-wrapper.md
```

- [ ] **Step 2: Verify nothing else references the deleted paths**

```bash
git status --short
grep -rl "minna-specify\|minna-plan\.md\|feature_roadmap\|1.0.0-safety-net" --include="*.md" --include="*.ts" --include="*.json" . 2>/dev/null | grep -v node_modules | grep -v /dist/
```
Expected: only the files just deleted show up in `git status` (as `D`), and the grep either returns nothing live-relevant or only historical mentions inside files being kept for good reason (e.g. `docs/conventions/review.md` mentioning `scripts/prompts/minna-*.md` generically — read any hit before deciding whether to touch it; if it's a real problem, note it in the final report rather than silently patching).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: quarantine CLI-era prompts and roadmap (tagged v1-cli-era)
EOF
)"
```

---

### Task 2: Work item + event types

**Files:**
- Modify: `src/core/types.ts`

**Interfaces:**
- Produces: `WorkItemState`, `Phase`, `PhaseGroup`, `WorkItemType`, `BlockedReason`, `WorkItem`, `WorkItemActor`, `ExecutionEventType`, `AgentMessageEventType`, `LifecycleEventType`, `WorkItemEventType`, `WorkItemEvent` — every later task imports these exact names from `./types.js`.

- [ ] **Step 1: Add the types**

Append to `src/core/types.ts`:

```ts
export type WorkItemState = "parked" | "active" | "blocked" | "closed";

export type Phase =
  | "spec"
  | "plan"
  | "tasks"
  | "requirements-review"
  | "implement"
  | "review"
  | "integrate";

export type PhaseGroup = "define" | "create" | "integrate";

export type WorkItemType = "feature" | "issue";

export type BlockedReason =
  | "clarification-required"
  | "approval-required"
  | "external-dependency"
  | "ci-pending"
  | "failed";

export interface WorkItem {
  id: string;
  title: string;
  description: string;
  state: WorkItemState;
  phase: Phase;
  phase_group: PhaseGroup;
  work_item_type: WorkItemType;
  blocked_reason: BlockedReason | null;
  assignee: string | null;
  project: string;
  branch: string | null;
  pr_url: string | null;
  created_at: string;
  updated_at: string;
}

export type WorkItemActor = "human" | "minna" | "claude" | "codex" | "agy";

export type ExecutionEventType =
  | "execution.started"
  | "execution.finished"
  | "process.launched"
  | "process.exited"
  | "manifest.received"
  | "review.requested"
  | "gate.passed"
  | "gate.blocked"
  | "git.branch_created"
  | "git.pr_opened"
  | "git.merged";

export type AgentMessageEventType =
  | "agent.question"
  | "agent.note"
  | "agent.finding"
  | "agent.summary";

export type LifecycleEventType =
  | "work_item.created"
  | "work_item.state_changed"
  | "human.decided";

export type WorkItemEventType = ExecutionEventType | AgentMessageEventType | LifecycleEventType;

export interface WorkItemEvent {
  id?: number;
  work_item_id: string;
  timestamp: string;
  actor: WorkItemActor;
  type: WorkItemEventType;
  summary: string;
  artifact_path: string | null;
  payload: unknown;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: compiles clean (new exported types, no consumers yet so nothing to break).

- [ ] **Step 3: Commit is deferred to the end of Task 2's implementation** — do not commit yet; this is one commit spanning all of Task 2's sub-tasks (see Task 7).

---

### Task 3: Pure work-item model functions (UI-safe, no I/O)

**Files:**
- Create: `src/core/work-item-model.ts`
- Test: `src/core/work-item-model.test.ts`

**Interfaces:**
- Consumes: `Phase`, `PhaseGroup`, `WorkItemType`, `BlockedReason`, `WorkItemEventType`, `ExecutionEventType`, `AgentMessageEventType`, `LifecycleEventType` from `./types.js` (Task 2).
- Produces: `derivePhaseGroup(phase: Phase): PhaseGroup`, `FEATURE_PHASE_SEQUENCE: Phase[]`, `ISSUE_PHASE_SEQUENCE: Phase[]`, `getPhaseSequence(type: WorkItemType): Phase[]`, `BlockedHolder` type, `BlockedPresentation` interface, `deriveBlockedPresentation(reason: BlockedReason): BlockedPresentation`, `EventFamily` type, `classifyEventFamily(type: WorkItemEventType): EventFamily` — Task 5 imports all of these.

- [ ] **Step 1: Write the failing tests**

Create `src/core/work-item-model.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import type { Phase, WorkItemEventType } from "./types.js";
import {
  classifyEventFamily,
  deriveBlockedPresentation,
  derivePhaseGroup,
  getPhaseSequence,
} from "./work-item-model.js";

test("derives the correct phase_group for every phase", () => {
  const expected: Record<Phase, string> = {
    spec: "define",
    plan: "define",
    tasks: "define",
    "requirements-review": "define",
    implement: "create",
    review: "create",
    integrate: "integrate",
  };

  for (const [phase, group] of Object.entries(expected) as Array<[Phase, string]>) {
    assert.equal(derivePhaseGroup(phase), group, `phase '${phase}' should derive '${group}'`);
  }
});

test("feature work items get the full 7-phase sequence", () => {
  assert.deepEqual(getPhaseSequence("feature"), [
    "spec",
    "plan",
    "tasks",
    "requirements-review",
    "implement",
    "review",
    "integrate",
  ]);
});

test("issue work items skip the define group entirely", () => {
  assert.deepEqual(getPhaseSequence("issue"), ["implement", "review", "integrate"]);
});

test("derives the correct UI label and holder for every blocked_reason", () => {
  assert.deepEqual(deriveBlockedPresentation("clarification-required"), { label: "Needs You", holder: "human" });
  assert.deepEqual(deriveBlockedPresentation("approval-required"), { label: "Needs You", holder: "human" });
  assert.deepEqual(deriveBlockedPresentation("external-dependency"), { label: "Blocked (external)", holder: "none" });
  assert.deepEqual(deriveBlockedPresentation("ci-pending"), { label: "Blocked (CI)", holder: "system" });
  assert.deepEqual(deriveBlockedPresentation("failed"), { label: "Needs You", holder: "human", alarm: true });
});

test("classifies execution events, agent messages, and lifecycle events into distinct families", () => {
  const cases: Array<[WorkItemEventType, string]> = [
    ["execution.started", "execution"],
    ["gate.blocked", "execution"],
    ["git.merged", "execution"],
    ["agent.summary", "agent_message"],
    ["agent.question", "agent_message"],
    ["work_item.created", "lifecycle"],
    ["work_item.state_changed", "lifecycle"],
    ["human.decided", "lifecycle"],
  ];

  for (const [type, family] of cases) {
    assert.equal(classifyEventFamily(type), family, `'${type}' should classify as '${family}'`);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --test src/core/work-item-model.test.ts`
Expected: FAIL — `Cannot find module './work-item-model.js'`

- [ ] **Step 3: Implement**

Create `src/core/work-item-model.ts`:

```ts
import type {
  AgentMessageEventType,
  BlockedReason,
  ExecutionEventType,
  LifecycleEventType,
  Phase,
  PhaseGroup,
  WorkItemEventType,
  WorkItemType,
} from "./types.js";

const PHASE_GROUP_BY_PHASE: Record<Phase, PhaseGroup> = {
  spec: "define",
  plan: "define",
  tasks: "define",
  "requirements-review": "define",
  implement: "create",
  review: "create",
  integrate: "integrate",
};

export function derivePhaseGroup(phase: Phase): PhaseGroup {
  return PHASE_GROUP_BY_PHASE[phase];
}

export const FEATURE_PHASE_SEQUENCE: Phase[] = [
  "spec",
  "plan",
  "tasks",
  "requirements-review",
  "implement",
  "review",
  "integrate",
];

export const ISSUE_PHASE_SEQUENCE: Phase[] = ["implement", "review", "integrate"];

export function getPhaseSequence(type: WorkItemType): Phase[] {
  return type === "feature" ? FEATURE_PHASE_SEQUENCE : ISSUE_PHASE_SEQUENCE;
}

export type BlockedHolder = "human" | "none" | "system";

export interface BlockedPresentation {
  label: string;
  holder: BlockedHolder;
  alarm?: true;
}

const BLOCKED_REASON_PRESENTATION: Record<BlockedReason, BlockedPresentation> = {
  "clarification-required": { label: "Needs You", holder: "human" },
  "approval-required": { label: "Needs You", holder: "human" },
  "external-dependency": { label: "Blocked (external)", holder: "none" },
  "ci-pending": { label: "Blocked (CI)", holder: "system" },
  failed: { label: "Needs You", holder: "human", alarm: true },
};

export function deriveBlockedPresentation(reason: BlockedReason): BlockedPresentation {
  return BLOCKED_REASON_PRESENTATION[reason];
}

const EXECUTION_EVENT_TYPES = new Set<ExecutionEventType>([
  "execution.started",
  "execution.finished",
  "process.launched",
  "process.exited",
  "manifest.received",
  "review.requested",
  "gate.passed",
  "gate.blocked",
  "git.branch_created",
  "git.pr_opened",
  "git.merged",
]);

const AGENT_MESSAGE_EVENT_TYPES = new Set<AgentMessageEventType>([
  "agent.question",
  "agent.note",
  "agent.finding",
  "agent.summary",
]);

const LIFECYCLE_EVENT_TYPES = new Set<LifecycleEventType>([
  "work_item.created",
  "work_item.state_changed",
  "human.decided",
]);

export type EventFamily = "execution" | "agent_message" | "lifecycle";

export function classifyEventFamily(type: WorkItemEventType): EventFamily {
  if (EXECUTION_EVENT_TYPES.has(type as ExecutionEventType)) return "execution";
  if (AGENT_MESSAGE_EVENT_TYPES.has(type as AgentMessageEventType)) return "agent_message";
  if (LIFECYCLE_EVENT_TYPES.has(type as LifecycleEventType)) return "lifecycle";
  throw new Error(`Unknown work item event type '${type}'.`);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsx --test src/core/work-item-model.test.ts`
Expected: PASS, all 5 tests green.

---

### Task 4: Extend the journal schema (work_items table + event columns)

**Files:**
- Modify: `src/core/db.ts` (only `initDb`'s schema `db.exec` block)
- Test: `src/core/db.test.ts` (append one schema-presence test)

**Interfaces:**
- Produces: `work_items` table (`id, title, description, state, phase, work_item_type, blocked_reason, assignee, project, branch, pr_url, created_at, updated_at`) and three new nullable columns on `events` (`work_item_id`, `summary`, `artifact_path`) — Task 5's storage functions read/write these directly via raw SQL (no ORM), so column names here are load-bearing for Task 5.

- [ ] **Step 1: Write the failing test**

Add to `src/core/db.test.ts` (near the existing "initializes journal tables" test):

```ts
test("initializes the work_items projection table and the events table's work-item columns", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-journal-workitems-"));
  const dbPath = join(dir, "minna.db");

  try {
    await initDb(dbPath);

    const db = new DatabaseSync(dbPath);
    const tableNames = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map(row => String((row as { name: string }).name));
    assert.ok(tableNames.includes("work_items"), "expected work_items table to be initialized");

    const eventColumns = db
      .prepare("PRAGMA table_info(events)")
      .all()
      .map(row => String((row as { name: string }).name));
    for (const column of ["work_item_id", "summary", "artifact_path"]) {
      assert.ok(eventColumns.includes(column), `expected events.${column} to exist`);
    }
    db.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --test src/core/db.test.ts`
Expected: FAIL — `work_items` not in `tableNames` (table doesn't exist yet).

- [ ] **Step 3: Implement — extend the schema block**

In `src/core/db.ts`, replace the `db.exec(...)` block inside `initDb` (currently creating `events`, `features`, and the two triggers) with:

```ts
    db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        actor TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        work_item_id TEXT,
        summary TEXT,
        artifact_path TEXT
      );

      CREATE TABLE IF NOT EXISTS features (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS work_items (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        state TEXT NOT NULL,
        phase TEXT NOT NULL,
        work_item_type TEXT NOT NULL,
        blocked_reason TEXT,
        assignee TEXT,
        project TEXT NOT NULL,
        branch TEXT,
        pr_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TRIGGER IF NOT EXISTS prevent_event_update
      BEFORE UPDATE ON events
      BEGIN
        SELECT RAISE(ROLLBACK, 'Updates are not allowed on the append-only events journal.');
      END;

      CREATE TRIGGER IF NOT EXISTS prevent_event_delete
      BEFORE DELETE ON events
      BEGIN
        SELECT RAISE(ROLLBACK, 'Deletions are not allowed on the append-only events journal.');
      END;
    `);
```

(Only the `events` table gains three trailing nullable columns and the new `work_items CREATE TABLE` block is inserted before the triggers — `features` and both triggers are unchanged.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsx --test src/core/db.test.ts`
Expected: PASS, all existing db.test.ts tests still green plus the new one.

- [ ] **Step 5: Run the full existing suite to confirm no regression**

Run: `npm test`
Expected: PASS (build + all `dist/**/*.test.js`, including `cli.test.ts`, `state.test.ts`, `project-context.test.ts`, `mcp.test.ts`, `tools.test.ts` — none of these touch the new columns/table, so none should change behavior).

---

### Task 5: Work-item storage (create, append event, set state, read)

**Files:**
- Create: `src/core/work-items.ts`
- Test: `src/core/work-items.test.ts`

**Interfaces:**
- Consumes: `openDb`, `initDb` from `./db.js` (Task 4); `derivePhaseGroup`, `getPhaseSequence`, `classifyEventFamily` from `./work-item-model.js` (Task 3); `WorkItem`, `WorkItemEvent`, `WorkItemState`, `Phase`, `WorkItemType`, `BlockedReason`, `WorkItemActor`, `WorkItemEventType` from `./types.js` (Task 2).
- Produces: `CreateWorkItemInput` interface, `createWorkItem(db, actor, input): Promise<WorkItem>`, `AppendWorkItemEventInput` interface, `appendWorkItemEvent(db, input): Promise<WorkItemEvent & { id: number }>`, `updateWorkItemState(db, actor, id, next): Promise<WorkItem>`, `readWorkItems(db, filter?): Promise<WorkItem[]>`, `readWorkItemEvents(db, workItemId): Promise<Array<WorkItemEvent & { id: number }>>` — Task 6 imports `createWorkItem` and the input type.

- [ ] **Step 1: Write the failing tests**

Create `src/core/work-items.test.ts`:

```ts
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { initDb } from "./db.js";
import { classifyEventFamily } from "./work-item-model.js";
import {
  appendWorkItemEvent,
  createWorkItem,
  readWorkItemEvents,
  readWorkItems,
  updateWorkItemState,
} from "./work-items.js";

async function withScratchDb(run: (db: DatabaseSync) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "minna-work-items-"));
  const dbPath = join(dir, "minna.db");
  let db: DatabaseSync | undefined;

  try {
    await initDb(dbPath);
    db = new DatabaseSync(dbPath);
    await run(db);
  } finally {
    db?.close();
    await rm(dir, { recursive: true, force: true });
  }
}

test("creating a feature work item defaults to the first phase of the full 7-phase sequence", async () => {
  await withScratchDb(async db => {
    const item = await createWorkItem(db, "human", {
      id: "celia-100",
      title: "Feature item",
      description: "desc",
      work_item_type: "feature",
      project: "celia",
    });
    assert.equal(item.phase, "spec");
    assert.equal(item.phase_group, "define");
    assert.equal(item.state, "parked");
  });
});

test("creating an issue work item defaults to implement, skipping the define group", async () => {
  await withScratchDb(async db => {
    const item = await createWorkItem(db, "human", {
      id: "celia-101",
      title: "Issue item",
      description: "desc",
      work_item_type: "issue",
      project: "celia",
    });
    assert.equal(item.phase, "implement");
    assert.equal(item.phase_group, "create");
  });
});

test("rejects a phase that does not belong to the work item type's sequence", async () => {
  await withScratchDb(async db => {
    await assert.rejects(
      () => createWorkItem(db, "human", {
        id: "celia-102",
        title: "Bad issue",
        description: "desc",
        work_item_type: "issue",
        project: "celia",
        phase: "spec",
      }),
      /spec.*issue|issue.*spec/i,
    );
  });
});

test("every derived phase_group on read matches the pure derivation for every phase", async () => {
  await withScratchDb(async db => {
    const phases: Array<[string, string]> = [
      ["spec", "define"], ["plan", "define"], ["tasks", "define"], ["requirements-review", "define"],
      ["implement", "create"], ["review", "create"], ["integrate", "integrate"],
    ];
    let counter = 0;
    for (const [phase, group] of phases) {
      const id = `celia-phase-${counter++}`;
      await createWorkItem(db, "human", {
        id, title: id, description: "d", work_item_type: "feature", project: "celia",
        phase: phase as never,
      });
    }
    const items = await readWorkItems(db, { project: "celia" });
    for (const [phase, group] of phases) {
      const item = items.find(candidate => candidate.phase === phase);
      assert.ok(item, `expected an item with phase '${phase}'`);
      assert.equal(item!.phase_group, group);
    }
  });
});

test("setting state to blocked with each blocked_reason produces the item read back with that reason", async () => {
  await withScratchDb(async db => {
    const reasons = ["clarification-required", "approval-required", "external-dependency", "ci-pending", "failed"] as const;
    let counter = 0;
    for (const reason of reasons) {
      const id = `celia-blocked-${counter++}`;
      await createWorkItem(db, "human", { id, title: id, description: "d", work_item_type: "issue", project: "celia" });
      const updated = await updateWorkItemState(db, "minna", id, { state: "blocked", blocked_reason: reason });
      assert.equal(updated.state, "blocked");
      assert.equal(updated.blocked_reason, reason);
    }
  });
});

test("rejects blocked_reason when state is not blocked", async () => {
  await withScratchDb(async db => {
    await createWorkItem(db, "human", { id: "celia-200", title: "t", description: "d", work_item_type: "issue", project: "celia" });
    await assert.rejects(
      () => updateWorkItemState(db, "minna", "celia-200", { state: "active", blocked_reason: "ci-pending" }),
      /blocked_reason.*blocked|blocked.*blocked_reason/i,
    );
  });
});

test("rejects blocked state without a blocked_reason", async () => {
  await withScratchDb(async db => {
    await createWorkItem(db, "human", { id: "celia-201", title: "t", description: "d", work_item_type: "issue", project: "celia" });
    await assert.rejects(
      () => updateWorkItemState(db, "minna", "celia-201", { state: "blocked" }),
      /blocked_reason/i,
    );
  });
});

test("an execution event and an agent message both append to a work item's history and are distinguishable by family", async () => {
  await withScratchDb(async db => {
    await createWorkItem(db, "human", { id: "celia-300", title: "t", description: "d", work_item_type: "issue", project: "celia" });
    await appendWorkItemEvent(db, {
      work_item_id: "celia-300", actor: "minna", type: "execution.finished",
      summary: "Process exited 0.", payload: { exitCode: 0 },
    });
    await appendWorkItemEvent(db, {
      work_item_id: "celia-300", actor: "codex", type: "agent.summary",
      summary: "Implementation complete.", payload: {},
    });

    const events = await readWorkItemEvents(db, "celia-300");
    // work_item.created (lifecycle) + the two appended events
    assert.equal(events.length, 3);
    const families = events.map(event => classifyEventFamily(event.type));
    assert.deepEqual(families, ["lifecycle", "execution", "agent_message"]);
  });
});

test("the events table stays append-only for work-item-scoped events", async () => {
  await withScratchDb(async db => {
    await createWorkItem(db, "human", { id: "celia-400", title: "t", description: "d", work_item_type: "issue", project: "celia" });
    await appendWorkItemEvent(db, {
      work_item_id: "celia-400", actor: "minna", type: "execution.started", summary: "Started.", payload: {},
    });
    assert.throws(() => db.exec("UPDATE events SET summary = 'tampered' WHERE work_item_id = 'celia-400'"), /not allowed/i);
    assert.throws(() => db.exec("DELETE FROM events WHERE work_item_id = 'celia-400'"), /not allowed/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --test src/core/work-items.test.ts`
Expected: FAIL — `Cannot find module './work-items.js'`

- [ ] **Step 3: Implement**

Create `src/core/work-items.ts`:

```ts
import type { DatabaseSync } from "node:sqlite";
import type {
  BlockedReason,
  Phase,
  WorkItem,
  WorkItemActor,
  WorkItemEvent,
  WorkItemEventType,
  WorkItemState,
  WorkItemType,
} from "./types.js";
import { derivePhaseGroup, getPhaseSequence } from "./work-item-model.js";

export interface CreateWorkItemInput {
  id: string;
  title: string;
  description: string;
  work_item_type: WorkItemType;
  project: string;
  state?: WorkItemState;
  phase?: Phase;
  blocked_reason?: BlockedReason | null;
  assignee?: string | null;
  branch?: string | null;
  pr_url?: string | null;
}

export interface AppendWorkItemEventInput {
  work_item_id: string;
  actor: WorkItemActor;
  type: WorkItemEventType;
  summary: string;
  artifact_path?: string | null;
  payload?: unknown;
}

export interface UpdateWorkItemStateInput {
  state: WorkItemState;
  phase?: Phase;
  blocked_reason?: BlockedReason | null;
}

function assertBlockedReasonConsistency(state: WorkItemState, blockedReason: BlockedReason | null | undefined): void {
  if (state === "blocked" && !blockedReason) {
    throw new Error("blocked_reason is required when state is 'blocked'.");
  }
  if (state !== "blocked" && blockedReason) {
    throw new Error(`blocked_reason must be null unless state is 'blocked' (got state '${state}').`);
  }
}

function assertPhaseBelongsToType(type: WorkItemType, phase: Phase): void {
  const sequence = getPhaseSequence(type);
  if (!sequence.includes(phase)) {
    throw new Error(`phase '${phase}' is not valid for work_item_type '${type}' (expected one of: ${sequence.join(", ")}).`);
  }
}

interface WorkItemRow {
  id: string;
  title: string;
  description: string;
  state: WorkItemState;
  phase: Phase;
  work_item_type: WorkItemType;
  blocked_reason: BlockedReason | null;
  assignee: string | null;
  project: string;
  branch: string | null;
  pr_url: string | null;
  created_at: string;
  updated_at: string;
}

function toWorkItem(row: WorkItemRow): WorkItem {
  return { ...row, phase_group: derivePhaseGroup(row.phase) };
}

function readWorkItemRow(db: DatabaseSync, id: string): WorkItem {
  const row = db.prepare(
    `SELECT id, title, description, state, phase, work_item_type, blocked_reason, assignee, project, branch, pr_url, created_at, updated_at
     FROM work_items WHERE id = ?`,
  ).get(id) as WorkItemRow | undefined;

  if (!row) {
    throw new Error(`Work item '${id}' was not found after journal write.`);
  }
  return toWorkItem(row);
}

export async function createWorkItem(db: DatabaseSync, actor: WorkItemActor, input: CreateWorkItemInput): Promise<WorkItem> {
  const state = input.state ?? "parked";
  const phase = input.phase ?? getPhaseSequence(input.work_item_type)[0];
  const blockedReason = input.blocked_reason ?? null;

  assertPhaseBelongsToType(input.work_item_type, phase);
  assertBlockedReasonConsistency(state, blockedReason);

  const timestamp = new Date().toISOString();

  db.exec("BEGIN TRANSACTION");
  try {
    const existing = db.prepare("SELECT 1 FROM work_items WHERE id = ?").get(input.id);
    if (existing) {
      throw new Error(`Work item '${input.id}' already exists.`);
    }

    db.prepare(
      `INSERT INTO events (timestamp, actor, type, payload, work_item_id, summary, artifact_path)
       VALUES (?, ?, 'work_item.created', ?, ?, ?, NULL)`,
    ).run(timestamp, actor, JSON.stringify({ ...input, state, phase, blocked_reason: blockedReason }), input.id, `Created: ${input.title}`);

    db.prepare(
      `INSERT INTO work_items (id, title, description, state, phase, work_item_type, blocked_reason, assignee, project, branch, pr_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      input.id, input.title, input.description, state, phase, input.work_item_type, blockedReason,
      input.assignee ?? null, input.project, input.branch ?? null, input.pr_url ?? null, timestamp, timestamp,
    );

    db.exec("COMMIT TRANSACTION");
  } catch (error) {
    try { db.exec("ROLLBACK TRANSACTION"); } catch { /* trigger may have already rolled back */ }
    throw error;
  }

  return readWorkItemRow(db, input.id);
}

export async function updateWorkItemState(
  db: DatabaseSync,
  actor: WorkItemActor,
  id: string,
  next: UpdateWorkItemStateInput,
): Promise<WorkItem> {
  const current = readWorkItemRow(db, id);
  const phase = next.phase ?? current.phase;
  const blockedReason = next.blocked_reason ?? null;

  assertPhaseBelongsToType(current.work_item_type, phase);
  assertBlockedReasonConsistency(next.state, blockedReason);

  const timestamp = new Date().toISOString();

  db.exec("BEGIN TRANSACTION");
  try {
    db.prepare(
      `INSERT INTO events (timestamp, actor, type, payload, work_item_id, summary, artifact_path)
       VALUES (?, ?, 'work_item.state_changed', ?, ?, ?, NULL)`,
    ).run(timestamp, actor, JSON.stringify({ state: next.state, phase, blocked_reason: blockedReason }), id, `State changed to '${next.state}'`);

    const result = db.prepare(
      `UPDATE work_items SET state = ?, phase = ?, blocked_reason = ?, updated_at = ? WHERE id = ?`,
    ).run(next.state, phase, blockedReason, timestamp, id);

    if (result.changes !== 1) {
      throw new Error(`Work item '${id}' was not found.`);
    }

    db.exec("COMMIT TRANSACTION");
  } catch (error) {
    try { db.exec("ROLLBACK TRANSACTION"); } catch { /* trigger may have already rolled back */ }
    throw error;
  }

  return readWorkItemRow(db, id);
}

export async function appendWorkItemEvent(
  db: DatabaseSync,
  input: AppendWorkItemEventInput,
): Promise<WorkItemEvent & { id: number }> {
  const timestamp = new Date().toISOString();
  const result = db.prepare(
    `INSERT INTO events (timestamp, actor, type, payload, work_item_id, summary, artifact_path)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    timestamp, input.actor, input.type, JSON.stringify(input.payload ?? {}),
    input.work_item_id, input.summary, input.artifact_path ?? null,
  );

  return {
    id: Number(result.lastInsertRowid),
    work_item_id: input.work_item_id,
    timestamp,
    actor: input.actor,
    type: input.type,
    summary: input.summary,
    artifact_path: input.artifact_path ?? null,
    payload: input.payload ?? {},
  };
}

export async function readWorkItems(db: DatabaseSync, filter?: { project?: string }): Promise<WorkItem[]> {
  const rows = (filter?.project === undefined
    ? db.prepare(
        `SELECT id, title, description, state, phase, work_item_type, blocked_reason, assignee, project, branch, pr_url, created_at, updated_at
         FROM work_items ORDER BY created_at ASC`,
      ).all()
    : db.prepare(
        `SELECT id, title, description, state, phase, work_item_type, blocked_reason, assignee, project, branch, pr_url, created_at, updated_at
         FROM work_items WHERE project = ? ORDER BY created_at ASC`,
      ).all(filter.project)) as WorkItemRow[];

  return rows.map(toWorkItem);
}

export async function readWorkItemEvents(db: DatabaseSync, workItemId: string): Promise<Array<WorkItemEvent & { id: number }>> {
  const rows = db.prepare(
    `SELECT id, timestamp, actor, type, summary, artifact_path, payload
     FROM events WHERE work_item_id = ? ORDER BY id ASC`,
  ).all(workItemId) as Array<{
    id: number; timestamp: string; actor: string; type: string;
    summary: string | null; artifact_path: string | null; payload: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    work_item_id: workItemId,
    timestamp: row.timestamp,
    actor: row.actor as WorkItemActor,
    type: row.type as WorkItemEventType,
    summary: row.summary ?? "",
    artifact_path: row.artifact_path,
    payload: JSON.parse(row.payload) as unknown,
  }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsx --test src/core/work-items.test.ts`
Expected: PASS, all 9 tests green.

---

### Task 6: Fixture/seed data for the UI prototype

**Files:**
- Create: `src/core/work-items.fixtures.ts`
- Test: `src/core/work-items.fixtures.test.ts`

**Interfaces:**
- Consumes: `CreateWorkItemInput` and `createWorkItem` from `./work-items.js` (Task 5); `initDb` from `./db.js`.
- Produces: `FIXTURE_WORK_ITEMS: CreateWorkItemInput[]`, `seedFixtureWorkItems(db, actor?): Promise<WorkItem[]>`.

- [ ] **Step 1: Write the failing test**

Create `src/core/work-items.fixtures.test.ts`:

```ts
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { initDb } from "./db.js";
import { readWorkItems } from "./work-items.js";
import { FIXTURE_WORK_ITEMS, seedFixtureWorkItems } from "./work-items.fixtures.js";

test("fixture data covers every state, every blocked_reason, and every phase_group", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minna-fixtures-"));
  const dbPath = join(dir, "minna.db");
  try {
    await initDb(dbPath);
    const db = new DatabaseSync(dbPath);
    await seedFixtureWorkItems(db);

    const items = await readWorkItems(db);
    assert.equal(items.length, FIXTURE_WORK_ITEMS.length);

    const states = new Set(items.map(item => item.state));
    for (const state of ["parked", "active", "blocked", "closed"]) {
      assert.ok(states.has(state as never), `expected fixture data to cover state '${state}'`);
    }

    const reasons = new Set(items.map(item => item.blocked_reason).filter(Boolean));
    assert.ok(reasons.has("clarification-required"));
    assert.ok(reasons.has("ci-pending"));

    const groups = new Set(items.map(item => item.phase_group));
    for (const group of ["define", "create", "integrate"]) {
      assert.ok(groups.has(group as never), `expected fixture data to cover phase_group '${group}'`);
    }

    db.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --test src/core/work-items.fixtures.test.ts`
Expected: FAIL — `Cannot find module './work-items.fixtures.js'`

- [ ] **Step 3: Implement**

Create `src/core/work-items.fixtures.ts`:

```ts
import type { DatabaseSync } from "node:sqlite";
import type { WorkItem, WorkItemActor } from "./types.js";
import { createWorkItem, type CreateWorkItemInput } from "./work-items.js";

export const FIXTURE_WORK_ITEMS: CreateWorkItemInput[] = [
  {
    id: "celia-021", title: "Recurring transactions", description: "Add recurring transactions to the budget list.",
    state: "active", phase: "implement", work_item_type: "feature",
    assignee: "codex", project: "celia",
  },
  {
    id: "celia-027", title: "Approved spec awaiting the gate", description: "Spec cleared clarify; waiting on the requirements-review gate.",
    state: "active", phase: "requirements-review", work_item_type: "feature",
    assignee: "claude", project: "celia",
  },
  {
    id: "celia-022", title: "Export to CSV", description: "Add CSV export for transaction history.",
    state: "parked", phase: "spec", work_item_type: "feature",
    assignee: null, project: "celia",
  },
  {
    id: "celia-028", title: "Fix typo in settings label", description: "Settings page label reads 'Preferrences'.",
    state: "parked", phase: "implement", work_item_type: "issue",
    assignee: null, project: "celia",
  },
  {
    id: "celia-024", title: "Budget rollover rules", description: "Define how unused budget rolls over month to month.",
    state: "blocked", phase: "plan", work_item_type: "feature",
    blocked_reason: "clarification-required", assignee: "claude", project: "celia",
  },
  {
    id: "celia-025", title: "Member colour picker", description: "Let household members pick a colour for their transactions.",
    state: "active", phase: "review", work_item_type: "feature",
    assignee: "claude", project: "celia",
  },
  {
    id: "celia-026", title: "CI environment sync", description: "Sync CI environment variables with the deploy target.",
    state: "blocked", phase: "implement", work_item_type: "feature",
    blocked_reason: "ci-pending", assignee: "codex", project: "celia",
  },
  {
    id: "celia-020", title: "Settings page", description: "Initial settings page implementation.",
    state: "closed", phase: "review", work_item_type: "feature",
    assignee: null, project: "celia",
  },
];

export async function seedFixtureWorkItems(db: DatabaseSync, actor: WorkItemActor = "minna"): Promise<WorkItem[]> {
  const created: WorkItem[] = [];
  for (const input of FIXTURE_WORK_ITEMS) {
    created.push(await createWorkItem(db, actor, input));
  }
  return created;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsx --test src/core/work-items.fixtures.test.ts`
Expected: PASS.

---

### Task 7: Full suite, build, and commit Task 2

**Files:** none new — verification + commit only.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — includes `db.test.ts` (Task 4's addition), `work-item-model.test.ts`, `work-items.test.ts`, `work-items.fixtures.test.ts`, plus every pre-existing test file unchanged.

- [ ] **Step 2: Run a clean build**

Run: `npm run build`
Expected: `tsc` compiles with zero errors under `strict: true`.

- [ ] **Step 3: Commit Task 2 as one commit, separate from Task 1**

```bash
git add src/core/types.ts src/core/db.ts src/core/db.test.ts src/core/work-item-model.ts src/core/work-item-model.test.ts src/core/work-items.ts src/core/work-items.test.ts src/core/work-items.fixtures.ts src/core/work-items.fixtures.test.ts
git commit -m "$(cat <<'EOF'
feat: work item state model (000) — types, journal storage, pure derivations

Data shape only, per minna-state-model-v0.md: four states, seven phases,
blocked_reason derivation, execution/agent-message/lifecycle event families.
No transition logic, no UI wiring — createWorkItem/updateWorkItemState are
direct unchecked-for-legality writes. Extends 001's events table (three new
nullable columns) with a new work_items projection table in the same
.minna/minna.db journal.
EOF
)"
```

- [ ] **Step 4: Write the final report**

Summarize for the operator (not a file — a chat message):
- What was removed in Task 1 (list) vs. what was flagged instead (constitution Development Workflow section lines needing an amendment pass; `docs/conventions/review.md` vs. the doc's own stated canonical path `docs/conventions/reviews.md`; `docs/findings-contract.md` referencing `docs/findings-contract-schema.json` vs. actual `docs/findings-contract-schema.json` — confirm exact filenames at report time; `.agent/skills/speckit-*` and the old `state.ts`/`workflow.ts`/`speckit-feature.yaml` left in place per operator's explicit choice).
- Confirmation 001's `db.ts` was reused (same `.minna/minna.db`, same `events` table extended with 3 nullable columns) rather than replaced, and why (structurally identical append-only-events-plus-same-transaction-projection pattern; only the projection shape and event family taxonomy differ).
- Confirmation all independent tests pass (`npm test` output).

---

## Self-review notes

- **Spec coverage:** every bullet in the brief's "In scope" and "Independent tests" sections maps to a task/test above (state/phase/phase_group/work_item_type/blocked_reason/event families/append-only). "Explicitly out of scope" items (transition logic, dispatch, checkpoints, UI wiring, multi-project config) have no corresponding task — confirmed absent by design.
- **Type consistency:** `WorkItemActor`, `WorkItemEventType`, `Phase`, `BlockedReason` names match exactly across Task 2 (definition), Task 3 (consumption in pure functions), Task 5 (consumption in storage), and Task 6 (consumption in fixtures).
- **No placeholders:** every step has runnable code; no "add error handling" or "similar to Task N" steps.
