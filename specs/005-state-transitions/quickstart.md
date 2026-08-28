# Quickstart: Feature 005 State Transitions

## Developer Walkthrough

This guide demonstrates how to execute and verify state transitions via the API and core services.

### 1. Execute Core State Transition (TypeScript)

```typescript
import { updateWorkItemState } from "@/core/work-items";
import { initDb } from "@/core/db";

const db = initDb(".minna/minna.db");

// Transition parked -> active
const updated = await updateWorkItemState(db, "human", "001", {
  state: "active",
});
console.log(`Updated state: ${updated.state}`); // "active"

// Transition active -> closed (reason: done)
const closed = await updateWorkItemState(db, "human", "001", {
  state: "closed",
  closed_reason: "done",
});
console.log(`Closed state: ${closed.state}, reason: ${closed.closed_reason}`); // "closed", "done"
```

### 2. Invoke State Transition API (HTTP)

```bash
# Transition parked -> active
curl -X PATCH http://localhost:3000/api/work-items/001/state \
  -H "Content-Type: application/json" \
  -d '{"project": "minna", "state": "active"}'

# Attempt illegal transition (closed -> active) -> Expect 422
curl -X PATCH http://localhost:3000/api/work-items/001/state \
  -H "Content-Type: application/json" \
  -d '{"project": "minna", "state": "active"}'
```

### 3. Run Verification Tests

```bash
# Run unit & API integration tests for state transitions
npm test -- src/core/__tests__/work-item-state.test.ts
npm test -- src/app/api/work-items/__tests__/state.test.ts
```
