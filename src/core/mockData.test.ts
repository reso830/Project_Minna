import assert from "node:assert/strict";
import test from "node:test";

import { mockEvents, mockFeatures } from "./mockData.js";
import { derivePhaseGroup } from "./work-item-model.js";

test("provides unique feature IDs and valid event associations", () => {
  assert.equal(mockFeatures.length, 8);
  assert.equal(new Set(mockFeatures.map((feature) => feature.id)).size, 8);

  for (const event of Object.values(mockEvents).flat()) {
    assert.ok(mockFeatures.some((feature) => feature.id === event.work_item_id));
    assert.match(event.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  }
});

test("includes an empty feature and a pending decision feature", () => {
  assert.deepEqual(mockEvents["checkout-redesign-003"], []);
  assert.equal(
    mockFeatures.find((feature) => feature.id === "checkout-redesign-002")?.blocked_reason,
    "clarification-required",
  );
});

test("uses the canonical phase group for every mock feature", () => {
  for (const feature of mockFeatures) {
    assert.equal(feature.phase_group, derivePhaseGroup(feature.phase));
  }
});
