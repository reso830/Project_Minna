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
  {
    // Not in the source doc's literal fixture list — added so phase_group "integrate" is
    // non-empty, per that section's own stated goal ("every phase_group non-empty").
    id: "celia-023", title: "Household invite flow", description: "Merge the reviewed invite-flow branch and open the PR.",
    state: "active", phase: "integrate", work_item_type: "feature",
    assignee: "codex", project: "celia",
  },
  {
    // Not in the source doc's literal fixture list — added so every BlockedReason (not just
    // clarification-required/ci-pending) is exercised, per review feedback on PR #4.
    id: "celia-029", title: "Multi-currency support", description: "Decide whether to store amounts in minor units across currencies.",
    state: "blocked", phase: "plan", work_item_type: "feature",
    blocked_reason: "approval-required", assignee: "claude", project: "celia",
  },
  {
    id: "celia-030", title: "Bank feed integration", description: "Waiting on the bank's sandbox API credentials.",
    state: "blocked", phase: "implement", work_item_type: "feature",
    blocked_reason: "external-dependency", assignee: null, project: "celia",
  },
  {
    id: "celia-031", title: "Legacy import script", description: "One-off script to import balances from the old ledger.",
    state: "blocked", phase: "implement", work_item_type: "issue",
    blocked_reason: "failed", assignee: "codex", project: "celia",
  },
];

export async function seedFixtureWorkItems(db: DatabaseSync, actor: WorkItemActor = "minna"): Promise<WorkItem[]> {
  const created: WorkItem[] = [];
  for (const input of FIXTURE_WORK_ITEMS) {
    created.push(await createWorkItem(db, actor, input));
  }
  return created;
}
