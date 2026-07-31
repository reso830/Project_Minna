# Minna Event Model v2

## Description

The event journal's data shape for Minna work items.

---

## Event (Card)

```json
{
  "id": 1042,
  "work_item_id": "021",
  "project": "celia",
  "timestamp": "2026-07-24T11:14:00Z",
  "actor": "codex",
  "type": "agent.message",
  "summary": "Implementation complete: 4 files changed, 12 tests passing.",
  "artifact_path": "specs/celia-021/reviews/r1-engr-review.json",
  "payload": {}
}
```

| Field | Why it's there |
|---|---|
| `id` | Auto-incrementing row number. Ordering and reference; not human-chosen. |
| `work_item_id` | Which work item this event belongs to. |
| `project` | Resolves against the project registry (`minna-project-registry.md`). Redundant within a single project's own journal file, but stable if events are ever merged into a cross-project view. |
| `timestamp` | When it happened. |
| `actor` | `human` / `minna` / `claude` / `codex` / `agy`. Provenance — who did this. |
| `type` | The machine-readable fact. Dot-namespaced. |
| `summary` | The one line the journal displays. |
| `artifact_path` | If the event produced a file (findings, diff, design handoff), link it. |
| `payload` | Structured detail behind the summary. Shape varies per `type`. |

---

## Operator events

| `type` | Payload fields |
|---|---|
| `human.decided` | `message` |
| `human.triggered` | `target_state`, `target_phase`, `note` |
| `human.manual_test_recorded` | JSON (in `payload`) |

---

## Agent events

| `type` | Payload fields |
|---|---|
| `agent.message` | `message` |
| `agent.finding` | (none — `summary` + `artifact_path` only) |
| `agent.question` | `question`, `options` (optional) |
---

## Minna events — Git

| `type` | Payload fields |
|---|---|
| `git.branch_created` | `branch`, `base_branch` |
| `git.pushed` | `branch`, `sha` |
| `git.pr_opened` | `branch`, `pr_url` |
| `git.merged` | `branch`, `sha` |
---

## Minna events — Lifecycle

| `type` | Payload fields |
|---|---|
| `work_item.created` | `work_item_type`, `title`, `project` |
| `work_item.state_changed` | `from`, `to`, `blocked_reason`, `closed_reason` |
| `work_item.phase_changed` | `from`, `to`, `trigger` |
---

## Minna events — System

| `type` | Payload fields |
|---|---|
| `process.launched` | `session_id`, `actor`, `phase` |
| `process.exited` | `session_id`, `exit_code`, `reason` |
| `session.message_sent` | `session_id`, `to_actor`, `prompt_path`, `feature_brief_path`, `design_handoff_path`, `message` |
| `gate.passed` | `phase`, `loop_count` |
| `gate.blocked` | `phase`, `loop_count`, `max_loop` |

## Revisions

- **v2** — added `closed_reason` to `work_item.state_changed` payload, matching the state model's v2 addition.
- **v1** — event card (incl. `project` field), operator events (3 types), agent events (3 types), Minna events — git (4 types), lifecycle (3 types), system (5 types, session-aware).