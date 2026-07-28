# Quickstart: Git Checkpoints

This guide helps developers interact with and test the **Git Checkpoints** feature.

## 1. CLI Usage Examples

Ensure the project is compiled (`npm run build` or use `npm run dev` to run with `tsx` dynamically).

### Creating a Checkpoint

To capture the current state of your repository's working directory, including unstaged, staged, untracked, and configured gitignored files:

```bash
# Create a checkpoint with a default message
npm run dev checkpoint

# Create a checkpoint with a custom message
npm run dev checkpoint --message "Refactoring core state parser"
```

Output:
```text
Checkpoint created: refs/minna/checkpoints/manual/20260718-143052/1
```

### Listing Checkpoints

To list all checkpoints or filter by context-type and grouping ID:

```bash
# List all checkpoints
npm run dev checkpoints

# Filter to list only pre-restore safety checkpoints
npm run dev checkpoints --context-type pre-restore

# Filter checkpoints in a specific timestamp group
npm run dev checkpoints --id 20260718-143052
```

Output:
```text
refs/minna/checkpoints/manual/20260718-143052/1 | 2026-07-18T14:30:52Z | parent: 2f10b7d6 | Refactoring core state parser
refs/minna/checkpoints/pre-restore/20260718-143210/1 | 2026-07-18T14:32:10Z | parent: 2f10b7d6 | Safety checkpoint before restore
```

### Restoring a Checkpoint

To restore the working directory state to a previously saved checkpoint:

```bash
# Restore using a full reference path
npm run dev restore refs/minna/checkpoints/manual/20260718-143052/1

# Restore using a short-format path
npm run dev restore manual/20260718-143052/1
```

If the working directory is dirty (contains uncommitted edits), Minna will automatically save your work first:
```text
Saved uncommitted changes to refs/minna/checkpoints/pre-restore/20260718-143522/1; recover with minna restore refs/minna/checkpoints/pre-restore/20260718-143522/1
Worktree restored from refs/minna/checkpoints/manual/20260718-143052/1
```

---

## 2. Library API Usage Examples

### Creating a Checkpoint programmatically

```typescript
import { openDb } from './core/db.js';
import { createCheckpoint } from './core/checkpoints.js';

const db = openDb();
try {
  const metadata = await createCheckpoint(db, {
    contextType: 'manual',
    message: 'Manual checkpoint via API'
  });
  console.log('Checkpoint created successfully:', metadata.ref);
} finally {
  db.close();
}
```

### Restoring a Checkpoint programmatically

```typescript
import { openDb } from './core/db.js';
import { restoreCheckpoint } from './core/checkpoints.js';

const db = openDb();
try {
  await restoreCheckpoint(db, 'refs/minna/checkpoints/manual/20260718-143052/1');
  console.log('Successfully restored worktree.');
} finally {
  db.close();
}
```
