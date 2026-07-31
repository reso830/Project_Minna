# Developer Quickstart: Work Item Management

**Feature Branch**: `003-work-item-management`

This quickstart guide describes how to run and test the database migrations, API routes, and UI flows for Work Item Management.

---

## 1. Running Database Migrations (Local SQLite)

Database schemas are self-healing and initialized lazily. When the application loads, the schema check runs.
To manually verify that the new columns are created:

1. Launch a PowerShell or bash shell in the project root.
2. If there are no existing databases, run:
   ```bash
   npm run dev:cli status
   ```
   This will initialize the databases.
3. To check if the new columns are successfully added, open the SQLite shell:
   ```bash
   sqlite3 .minna/minna.db ".schema work_items"
   ```
   Verify that these fields are listed:
   - `closed_reason`
   - `feature_brief_path`
   - `spec_path`
   - `plan_path`
   - `tasks_path`
   - CHECK constraint: `CHECK(length(description) <= 100)`
4. Also verify the events table schema:
   ```bash
   sqlite3 .minna/minna.db ".schema events"
   ```
   Verify the `project` column is listed.

---

## 2. Testing the APIs

You can test the work items API endpoints using `curl` or any API client. Make sure the development server is running (`npm run dev`).

### A. List Work Items
```bash
curl "http://localhost:3000/api/work-items?project=celia"
```

### B. Create a Feature
```bash
curl -X POST http://localhost:3000/api/work-items \
  -H "Content-Type: application/json" \
  -d '{
    "project": "celia",
    "title": "Payment gateway integrations",
    "description": "Enables Stripe and Paypal payment processing flow.",
    "detailsText": "# Objective\nEnables payment options."
  }'
```

### C. Update a Feature (Description & Details)
```bash
curl -X PATCH http://localhost:3000/api/work-items/001 \
  -H "Content-Type: application/json" \
  -d '{
    "project": "celia",
    "description": "Enables Stripe and Paypal credit card processing flow.",
    "detailsText": "# Updated Objective\nSupport custom refund handling."
  }'
```

### D. Drop a Feature
```bash
curl -X POST http://localhost:3000/api/work-items/001/drop \
  -H "Content-Type: application/json" \
  -d '{ "project": "celia" }'
```

---

## 3. Running Automated Tests

To validate database repository logic, migrations, API endpoint handlers, and frontend modal actions, run the specific test files using these commands:

```bash
# Compile the CLI and run core/repository unit tests
npm run build:cli && node --test dist/core/__tests__/repositories.test.js

# Run Next.js API integration tests
npx jest src/app/api/work-items/__tests__/work-items.test.ts

# Run UI frontend tests
npx jest src/components/__tests__/AddUpdateFeatureModal.test.tsx

# Run full test suite (builds CLI and runs all tests)
npm test
```
