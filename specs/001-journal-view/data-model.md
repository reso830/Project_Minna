# Data Model: Journal View (Mock & Session State)

This document defines the mock data representations and the `sessionStorage` schema used to power the **Journal View** frontend.

---

## 1. Mock Domain Schema

The mock frontend data maps directly to the TypeScript schemas in [types.ts](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts).

### Projects & Features (WorkItems)

Features in the projects list are represented as [WorkItem](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts#L75) records.
* **Globally Unique ID Keying**: Each feature possesses a globally unique ID (e.g., `checkout-redesign-001`), preventing collisions between matching numbers across different projects. The 3-digit sequence (`001`) is preserved as a separate display field (or derived prefix) for rendering in lists and headers.
* **Schema Mapping**:
  * **Checkout Redesign** (`checkout-redesign`):
    - `checkout-redesign-001`: Cart drawer refactor (status: `"active"`, phase: `"implement"`)
    - `checkout-redesign-002`: Payment retries (status: `"blocked"`, phase: `"review"`, blocked reason: `"clarification-required"`)
    - `checkout-redesign-003`: Empty state copy (status: `"closed"`, phase: `"integrate"`)
  * **Search Revamp** (`search-revamp`):
    - `search-revamp-001`: Fuzzy match ranking (status: `"parked"`, phase: `"spec"`)
    - `search-revamp-002`: Search analytics (status: `"parked"`, phase: `"spec"`)
  * **Billing v2** (`billing-v2`):
    - `billing-v2-001`: Invoice PDF export (status: `"blocked"`, phase: `"plan"`, blocked reason: `"approval-required"`)
    - `billing-v2-002`: Proration logic (status: `"parked"`, phase: `"spec"`)
  * **Notifications** (`notifications`):
    - `notifications-001`: Digest emails (status: `"parked"`, phase: `"spec"`)

* **Example Feature JSON**:
  ```json
  {
    "id": "checkout-redesign-001",
    "title": "Cart drawer refactor",
    "description": "Refactor the slide-out shopping cart drawer for optimized performance.",
    "state": "active",
    "phase": "implement",
    "phase_group": "create",
    "work_item_type": "feature",
    "blocked_reason": null,
    "assignee": "claude",
    "project": "Checkout Redesign",
    "branch": "feat/cart-drawer-refactor",
    "pr_url": "https://github.com/org/repo/pull/12",
    "created_at": "2026-07-28T09:00:00Z",
    "updated_at": "2026-07-28T10:15:00Z"
  }
  ```

### Timeline Events (WorkItemEvents)

Messages and system operations inside each feature timeline map to [WorkItemEvent](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts#L121) records.
* **Schema Mapping**:
  * Message bubbles map to events with type: `"agent.question"`, `"agent.note"`, `"agent.finding"`, `"agent.summary"`, or lifecycle events like `"work_item.created"`.
  * User reply inputs are appended as `"human.message"` with actor `"human"`.
  * Diffs, plan outlines, and agent terminal logs are structured within the event's `payload` object.

* **Example Event JSON (Message)**:
  ```json
  {
    "work_item_id": "checkout-redesign-001",
    "timestamp": "2026-07-28T09:05:00Z",
    "actor": "claude",
    "type": "agent.note",
    "summary": "I have set up the basic components. Need to refine the animations next.",
    "artifact_path": null,
    "payload": {}
  }
  ```

---

## 2. Session State Schema (`sessionStorage`)

To support user interactions without a database, UI preferences and inputs are stored in the browser's `sessionStorage` using the following keys:

| Key | Type | Description |
|-----|------|-------------|
| `minna_active_feature_id` | `string` | The unique ID of the currently selected active feature (e.g. `"checkout-redesign-001"`). |
| `minna_project_expanded_[projectName]` | `boolean` | Expanded toggle state for the sidebar project list. |
| `minna_agent_expanded_[agentId]` | `boolean` | Collapsed/expanded state of individual agent consoles. |
| `minna_active_right_tab` | `string` | Currently active tab in the detail panel (`"agents" \| "md" \| "diff"`). |
| `minna_replies_[featureId]` | `JSON Array` | Serialized list of user-submitted composer messages for the feature (keyed on unique feature ID). |
| `minna_decisions_[featureId]` | `JSON Object` | Stores resolved decisions (keyed on unique feature ID). Maps decision message/event index to chosen answer (e.g. `{"1": "Approve changes"}`). |

---

## 3. Mock Assets Structure

Plan markdown and code diff contents will be loaded as static, hardcoded properties of the mock data definition, keyed by the feature ID:

* **Plan Markdown Mapping**:
  * Active plan mock details live in the dataset under `mockPlanMarkdown[featureId]`. Monospace rendered with cyan headers.
* **Diff Mapping**:
  * Unified diff content lives under `mockDiffs[featureId]`. Follows standard unified format (lines beginning with `+` marked green, `-` marked red, `@@` hunk headers marked gray).
