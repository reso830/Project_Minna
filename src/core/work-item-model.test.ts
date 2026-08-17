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
    "spec-review": "define",
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
    "spec-review",
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
    ["human.manual_test_recorded", "lifecycle"],
  ];

  for (const [type, family] of cases) {
    assert.equal(classifyEventFamily(type), family, `'${type}' should classify as '${family}'`);
  }
});
