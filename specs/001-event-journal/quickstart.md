# Quickstart: Event Journal

This guide helps developers interact with and test the **Event Journal** feature.

## 1. Database Setup

The SQLite database file is located at `.minna/minna.db` (in the project root).
The database schema is automatically initialized on the first command run or API call. You do not need to run manual schema creation scripts.

To inspect the database directly without requiring an external `sqlite3` client binary, use the following Node.js one-liner:
```bash
# Print all events in the log
node -e "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync('.minna/minna.db'); console.table(db.prepare('SELECT id, timestamp, actor, type FROM events').all());"

# Print all features in the current projection
node -e "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync('.minna/minna.db'); console.table(db.prepare('SELECT id, title, status FROM features').all());"
```

---

## 2. CLI Usage Examples

Ensure the project is compiled (`npm run build` or use `npm run dev` to run with `tsx` dynamically).

### Viewing the Journal Timeline

```bash
# Print all events across all features
npm run dev log

# Print events filtered by a specific feature ID
npm run dev log --feature project-a-new-feature-1721165168
```

### Verifying Database Integrity

Run verification to check for drift or invariant violations:
```bash
npm run dev verify
```
If verification passes, it will print success and exit `0`. If any row in the `features` projection was modified directly via SQL or an orphan row exists, it will output the error and exit `1`.

### Exporting the Feature Timeline

Export the Markdown-formatted history of a feature for committing to Git:
```bash
npm run dev export --feature project-a-new-feature-1721165168 ./specs/001-event-journal
```
This generates or overwrites `./specs/001-event-journal/journal.md`.

---

## 3. Library API Usage Examples

### Initializing a Feature

```typescript
import { createFeature, initDb, openDb } from './core/db.js';

await initDb();
const db = openDb();
try {
  const feature = await createFeature(
    db,
    'human',
    'my-project-new-feature-1721165168',
    'Implement Event Journal',
    'initial' // Required application-defined status, not a workflow phase
  );
  console.log('Created Feature:', feature);
} finally {
  db.close();
}
```

### Updating Feature Status

```typescript
import { initDb, openDb, updateFeatureStatus } from './core/db.js';

await initDb();
const db = openDb();
try {
  const updated = await updateFeatureStatus(
    db,
    'system',
    'my-project-new-feature-1721165168',
    'plan'
  );
  console.log('Updated Feature:', updated);
} finally {
  db.close();
}
```
