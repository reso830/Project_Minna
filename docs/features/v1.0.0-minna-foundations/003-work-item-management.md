# Feature 003 - Work Item Management

## Summary

Implement the creation and management of work items within a Minna project.

This feature introduces the project's backlog by allowing users to create, view, and update work items. It establishes the core unit of work that future lifecycle, orchestration, and journal features will build upon.

---

## Background

Work items represent individual units of work within a project.

Each work item conforms to the Minna State Model and belongs to exactly one project. Work items are persisted locally and serve as the foundation for future execution, agent sessions, and event journals.

---

## Objectives

- Allow users to create work items.
- Allow users to update work item metadata.
- Allow users to mark work items as dropped.
- Display the project backlog.
- Persist work items.
- Establish the foundation for future lifecycle and orchestration features.

---

## Scope

### Included

- Create Work Item
- Update Work Item
- Drop Work Item
- Work Item List
- Work Item Details
- Feature and Issue work item types
- Local persistence

### Excluded

- State transition workflows
- Phase transition workflows
- Board View
- Journal generation
- Agent execution
- Session management
- Git integration
- Human approval workflows

---

## Functional Requirements

### Create Work Item

Users can create a new work item.

Required inputs:

- Type (`feature` or `issue`)
- Title
- Description

The title is entered as freeform text.

Upon creation, Minna shall:

- Slugify the title (lowercase, replace spaces with hyphens, remove unsupported characters).
- Persist only the slugified value as the work item's `title`.
- Discard the original freeform input.

The slugified title is immutable after creation.

The description shall be limited to a maximum of **100 characters**. The input shall enforce this limit directly and prevent additional characters from being entered.

The application shall automatically assign:

- Project
- Work item ID
- Initial state
- Initial phase
- Created timestamp
- Updated timestamp

The following fields shall be initialized automatically:

- `blocked_reason = null`
- `closed_reason = null`
- `branch = null`
- `pr_url = null`
- `assignee = null`

---

### Work Item Initialization

New work items shall be initialized according to the Minna State Model.

Feature work items begin in the **Spec** phase.

Issue work items begin in the **Implement** phase.

Both work item types begin in the **Parked** state.

---

### Work Item IDs

Work item IDs shall be:

- Project-scoped
- Sequential
- Three-digit identifiers

Example:

```
001
002
003
```

Each project maintains a monotonically increasing work item counter.

The counter increments once for every newly created work item and is never decremented or reused.

Work item IDs are immutable after creation.

---

### Update Work Item

Users may update only the following field:

- Description

The following fields are immutable:

- ID
- Title
- Project
- State
- Phase
- Created timestamp
- Updated timestamp

---

### Drop Work Item

Work items are never physically deleted.

Instead, the user may mark a work item as dropped, causing it to transition to the `closed` state with:

```
closed_reason = dropped
```

The UI shall use wording that reflects this behavior (for example, **Drop** or **Archive**) rather than **Delete**.

The valid source states for this transition shall be defined during specification and shall not be assumed by this feature brief.

---

### Work Item List

Display all work items belonging to the current project.

Each item shall display, at minimum:

- ID
- Title
- Type
- State
- Phase
- Assignee

The Assignee column will remain empty throughout this feature because work items are not assigned until agent execution creates a session in a future feature.

Simple sorting and filtering are sufficient for this feature.

---

## Design Reference

The accompanying design handoff is the source of truth for:

- Layout
- Navigation
- Component styling
- Interaction behavior

Implementation should follow the approved design unless technical constraints require minor adjustments.

---

## References

This feature shall conform to:

- `docs/minna-state-model.md`
- `docs/minna-event-model.md`

---

## Acceptance Criteria

- Users can create Feature work items.
- Users can create Issue work items.
- Freeform titles are slugified before being persisted.
- Persisted titles are immutable after creation.
- Description input enforces a maximum length of 100 characters.
- Work item IDs are generated using a project-scoped monotonically increasing counter.
- Newly created work items conform to the Minna State Model.
- All initial field values are initialized correctly.
- Users can update the description of a work item.
- Users can mark a work item as dropped without physically removing it.
- Work items persist across application restarts.
- The project backlog displays all work items.
- The feature operates entirely offline.
- No agent execution, journal generation, or orchestration is required.

---

## Notes

This feature establishes the project's backlog and the core work item model.

Future features will introduce lifecycle management, board visualization, journal events, agent sessions, Git integration, and orchestration while building upon the work items created here.