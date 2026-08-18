# Feature 004 - Details Panel

## Summary

Add an expandable **Details panel** to the Journal View that lets the user inspect metadata for the currently selected feature without leaving the Journal.

The panel is normally hidden and can be temporarily revealed or pinned open.

## Goal

Provide quick access to feature context while keeping the Journal focused on conversation and execution history.

## Details Content

The panel displays read-only metadata for the currently selected feature:

* **ID**
* **Title**
* **Type**
* **Assignee**
* **Description**

## Interaction

### Hover

Hovering over the Details control opens the panel temporarily.

The panel remains open while the pointer is over either:

* the Details control; or
* the Details panel.

Leaving both areas closes the panel unless it has been pinned.

### Pin

Clicking the Details control pins the panel open.

When pinned:

* the panel remains visible regardless of pointer position;
* the control indicates the pinned state;
* clicking the control again unpins it.

### Feature Switching

Details state is scoped to the selected feature.

When another feature is selected:

* temporary hover state is cleared;
* pinned state is cleared;
* the Details panel starts closed.

## Layout Behavior

The Details panel appears directly below the Journal header and participates in the normal layout.

Opening the panel pushes the Journal content downward rather than overlaying it.

When the panel opens or closes, the Journal should remain positioned at the newest entry.

## Out of Scope

This feature does not include:

* Editing feature metadata.
* Changing the assignee.
* Changing feature status or SDD phase.
* Additional feature-management actions.
* Changes to Journal entries or log streaming.

## Acceptance Criteria

* [ ] A Details control is available from the Journal header.
* [ ] Hovering over the control temporarily opens the Details panel.
* [ ] The panel remains open while hovering over the panel itself.
* [ ] Leaving the Details area closes an unpinned panel.
* [ ] Clicking the control pins the panel open.
* [ ] Clicking again unpins it.
* [ ] The panel displays ID, title, type, assignee, and description for the selected feature.
* [ ] The panel is read-only.
* [ ] Opening the panel pushes Journal content down rather than overlaying it.
* [ ] The Journal remains positioned at its newest entry when the panel opens or closes.
* [ ] Switching features resets the Details panel to closed.
