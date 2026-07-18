# Pre-Implementation Review Checklist: Event Journal

**Purpose**: Verification gate to check the plan and design artifacts against specifications, architecture soundness, and the Project Constitution before any implementation code is written.
**Created**: 2026-07-16
**Feature**: [spec.md](../spec.md)

**Gate result**: PASS (2026-07-16)

## 1. Specification & Scope Alignment

- [x] **CHK001**: The plan is strictly limited to the Event Journal feature and does not implement or address git checkpoints (002), agent runners (003), or workflow reviews (006-007).
- [x] **CHK002**: The `features` projection schema is minimized, containing only `id`, `title`, `status`, `created_at`, and `updated_at`, explicitly omitting M2 fields (`phase`, `decisions`, `manualTests`).
- [x] **CHK003**: The plan handles CLI command routing and expected outputs for `minna log`, `minna verify`, and `minna export` as specified.

## 2. Architecture & Data Integrity

- [x] **CHK004**: Database file path is set to `.minna/minna.db` under the local workspace root, honoring local-first data storage (Constitution VI).
- [x] **CHK005**: All state-changing API operations (creation, status update) are designed to execute within a single SQLite transaction, ensuring a projection write never occurs without its corresponding event insert (Constitution III).
- [x] **CHK006**: The low-level `recordEvent` transaction wrapper automatically rolls back the entire transaction if either the event insert or the projection update fails.

## 3. Verification & Invariant Enforcement

- [x] **CHK007**: The `minna verify` implementation plans to replay historical event entries in ascending chronological order (`id` ASC) to re-derive the current features projection from scratch.
- [x] **CHK008**: The verification replay logic checks for structural equivalence (row-by-row, column-by-column comparison) between the re-derived projection and the database table.
- [x] **CHK009**: The verification logic asserts the core invariant: every feature row in the projection table must trace back to exactly one `feature.created` event in the log.

## 4. Contract Correctness & Error Behavior

- [x] **CHK010**: `minna log --feature <id>` and `minna export --feature <id>` fail closed (exit non-zero) if feature `<id>` does not exist in the journal.
- [x] **CHK011**: An empty database state is handled gracefully by `minna log` (prints a notice and exits 0), rather than throwing an exception.
- [x] **CHK012**: Calling `updateFeatureStatus` for an unknown feature ID fails closed (rejects transaction, records nothing).
- [x] **CHK013**: `minna export` writes exclusively a Markdown document to `<dir>/journal.md`, avoiding duplicate format outputs (JSONL, HTML) and creating `<dir>` if necessary.

## 5. Constitution & Cost Compliance

- [x] **CHK014**: The technical plan relies exclusively on Node's built-in `node:sqlite` module, requiring zero new external package dependencies (Constitution XII).
- [x] **CHK015**: No remote, hosted, or cloud services are required for storage, testing, or operation, keeping resource usage completely local and cost-free (Constitution XVI).
- [x] **CHK016**: No workflow state is derived from LLM prose, and state transitions are strictly driven by SQLite events (Constitution II).
- [x] **CHK017**: No state-mutating authority is granted to external agents or subprocesses (Constitution XIII).
- [x] **CHK018**: No git checkout, switch, rebase, or push commands are executed under this feature's scope (Constitution XIII).
