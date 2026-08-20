import assert from "node:assert/strict";
import test from "node:test";
import type { WorkItemState } from "../types.js";
import {
  IllegalStateTransitionError,
  validateStateTransition,
} from "../work-item-model.js";

const legalTransitions: Array<[WorkItemState, WorkItemState]> = [
  ["parked", "active"],
  ["parked", "closed"],
  ["active", "parked"],
  ["active", "blocked"],
  ["active", "closed"],
  ["blocked", "active"],
  ["blocked", "parked"],
  ["blocked", "closed"],
];

const illegalTransitions: Array<[WorkItemState, WorkItemState, WorkItemState[]]> = [
  ["parked", "parked", ["active", "closed"]],
  ["parked", "blocked", ["active", "closed"]],
  ["active", "active", ["parked", "blocked", "closed"]],
  ["blocked", "blocked", ["active", "parked", "closed"]],
  ["closed", "parked", []],
  ["closed", "active", []],
  ["closed", "blocked", []],
  ["closed", "closed", []],
];

test("permits every canonical state transition", () => {
  for (const [from, to] of legalTransitions) {
    assert.doesNotThrow(() => validateStateTransition(from, to), `${from} -> ${to} should be legal`);
  }
});

test("rejects every non-canonical state transition with available targets", () => {
  for (const [from, to, allowed] of illegalTransitions) {
    assert.throws(
      () => validateStateTransition(from, to),
      (error: unknown) => {
        if (!(error instanceof IllegalStateTransitionError)) return false;
        assert.equal(error.from, from);
        assert.equal(error.to, to);
        assert.deepEqual(error.allowed, allowed);
        return true;
      },
      `${from} -> ${to} should be rejected`,
    );
  }
});
