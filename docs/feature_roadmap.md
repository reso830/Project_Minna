# Feature Roadmap

| Feature | Release | Status | Summary |
| --- | --- | --- | --- |
| `001-journal-view` | `0.3.0` | Completed | Next.js Journal View workspace with project navigation, event timelines, decisions, composer replies, and feature detail tabs backed by representative mock data. |
| `002-project-creation` | `0.5.0` | Completed | Central SQLite database-backed project registry, local project scaffolding/lazy databases, native OS picker endpoints, validation error modal, context traversal walking, and CLI registry syncing. Extended with project rename, relocate validation, removal, and ongoing health checks. |
| `003-work-item-management` | `0.6.0` | Completed | Local SQLite event database schema migrations, repository patterns, sequential project-scoped 3-digit IDs, title slugification, transactional file-write/rename brief pipelines, CenterPanel details layout, sidebar popovers/edit hover actions, and Add/Update/Drop confirmation modals. |
| `004-details-panel` | `0.7.0` | Completed | Expandable Details panel in the Journal View displaying feature metadata, 150ms debounced hover reveal, pin persistence with explicit hover clearing on unpin, per-feature state scoping, assignee avatar tiles, and timeline scroll position anchoring. |
| `005-state-transitions` | `0.8.0` | Completed | Operator-triggered work item state transitions (Start quick phrase for parked items, status chip hover dropdown, Close reason selection modal replacing Drop) with single work_item.state_changed event persistence in local SQLite and 422 error handling. |
