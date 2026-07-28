# Frontend State Contract

This document defines the React Context / State Store contract that governs the **Journal View** user interface.

---

## 1. UI Context State Schema

```typescript
export interface WorkspaceState {
  // Navigation & Selections (using globally unique feature IDs, e.g. "checkout-redesign-001")
  activeFeatureId: string | null;
  activeRightTab: "agents" | "md" | "diff";

  // Sidebar Expand/Collapse
  expandedProjects: Record<string, boolean>; // Maps project name to toggle state
  expandedAgents: Record<string, boolean>;   // Maps agent id to toggle state

  // Workspace Mock Data Arrays
  features: WorkItem[];
  events: Record<string, WorkItemEvent[]>;   // Maps globally unique feature ID to events array

  // User Interactive Overlays
  resolvedDecisions: Record<string, Record<string, string>>; // Maps globally unique feature ID -> { decisionId -> chosenOption }
}

export interface WorkspaceActions {
  selectFeature: (featureId: string) => void;
  setRightTab: (tab: "agents" | "md" | "diff") => void;
  toggleProject: (projectName: string) => void;
  toggleAgent: (agentId: string) => void;
  submitReply: (featureId: string, text: string) => void;
  submitDecision: (featureId: string, decisionId: string, option: string) => void;
}
```

---

## 2. API Method Behaviors

### `selectFeature(featureId: string)`
* **Behavior**:
  - Updates `activeFeatureId` in the workspace state.
  - Syncs the selection to `sessionStorage.setItem('minna_active_feature_id', featureId)`.
  - Automatically resets/forces the timeline to scroll to the bottom.

### `submitReply(featureId: string, text: string)`
* **Behavior**:
  - Appends a new [WorkItemEvent](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts#L121) to the timeline array for the specific unique `featureId`.
  - Set event fields:
    - `timestamp`: Current ISO string.
    - `actor`: `"human"`.
    - `type`: `"human.message"`.
    - `summary`: `text`.
  - Reads existing list of replies for the feature from `sessionStorage`, appends the new message, and saves back the updated array.

### `submitDecision(featureId: string, decisionId: string, option: string)`
* **Behavior**:
  - Resolves the decision identified by `decisionId` on feature `featureId`.
  - Saves the resolved selection to `sessionStorage`.
  - Searches the matching [WorkItem](file:///D:/Alvin/_CodeProjects/Project_Minna/src/core/types.ts#L75) in the state:
    - Sets `state = "active"`.
    - Sets `blocked_reason = null`.
  - Appends a system/human decision confirmation event to the timeline log.
