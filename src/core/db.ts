import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Actor, EventEnvelope, FeatureProjection } from "./types.js";
import { isWorkItemEventType } from "./work-item-model.js";

const DEFAULT_DB_PATH = join(".minna", "minna.db");

const EVENT_WORK_ITEM_COLUMNS = ["work_item_id", "summary", "artifact_path"] as const;

export function openDb(dbPath = DEFAULT_DB_PATH): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

/**
 * A database initialized by a prior release has an `events` table without the work-item
 * columns; `CREATE TABLE IF NOT EXISTS` leaves that schema untouched, so the columns must
 * be added explicitly on every initDb call.
 */
function migrateEventsWorkItemColumns(db: DatabaseSync): void {
  const existingColumns = new Set(
    (db.prepare("PRAGMA table_info(events)").all() as Array<{ name: string }>).map(row => row.name),
  );

  for (const column of EVENT_WORK_ITEM_COLUMNS) {
    if (!existingColumns.has(column)) {
      db.exec(`ALTER TABLE events ADD COLUMN ${column} TEXT`);
    }
  }
}

export async function initDb(dbPath = DEFAULT_DB_PATH): Promise<void> {
  await mkdir(dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);

  try {
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        actor TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        work_item_id TEXT,
        summary TEXT,
        artifact_path TEXT
      );

      CREATE TABLE IF NOT EXISTS features (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS work_items (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        state TEXT NOT NULL,
        phase TEXT NOT NULL,
        work_item_type TEXT NOT NULL,
        blocked_reason TEXT,
        assignee TEXT,
        project TEXT NOT NULL,
        branch TEXT,
        pr_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TRIGGER IF NOT EXISTS prevent_event_update
      BEFORE UPDATE ON events
      BEGIN
        SELECT RAISE(ROLLBACK, 'Updates are not allowed on the append-only events journal.');
      END;

      CREATE TRIGGER IF NOT EXISTS prevent_event_delete
      BEFORE DELETE ON events
      BEGIN
        SELECT RAISE(ROLLBACK, 'Deletions are not allowed on the append-only events journal.');
      END;
    `);

    migrateEventsWorkItemColumns(db);
  } finally {
    db.close();
  }
}

type FeatureCreatedPayload = {
  id: string;
  title: string;
  status: string;
};

type FeatureStatusUpdatedPayload = {
  id: string;
  status: string;
};

type EventPayload = FeatureCreatedPayload | FeatureStatusUpdatedPayload;

type RecordEventOptions = {
  faultInjection?: boolean;
};

function asFeatureCreatedPayload(payload: unknown): FeatureCreatedPayload {
  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof (payload as FeatureCreatedPayload).id !== "string" ||
    typeof (payload as FeatureCreatedPayload).title !== "string" ||
    typeof (payload as FeatureCreatedPayload).status !== "string"
  ) {
    throw new Error("feature.created requires string id, title, and status fields.");
  }

  return payload as FeatureCreatedPayload;
}

function asFeatureStatusUpdatedPayload(payload: unknown): FeatureStatusUpdatedPayload {
  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof (payload as FeatureStatusUpdatedPayload).id !== "string" ||
    typeof (payload as FeatureStatusUpdatedPayload).status !== "string"
  ) {
    throw new Error("feature.status_updated requires string id and status fields.");
  }

  return payload as FeatureStatusUpdatedPayload;
}

function readFeature(db: DatabaseSync, id: string): FeatureProjection {
  const feature = db.prepare(
    "SELECT id, title, status, created_at, updated_at FROM features WHERE id = ?",
  ).get(id) as FeatureProjection | undefined;

  if (!feature) {
    throw new Error(`Feature '${id}' was not found after journal write.`);
  }

  return feature;
}

function applyProjection(db: DatabaseSync, type: string, payload: EventPayload, timestamp: string): void {
  if (type === "feature.created") {
    const created = asFeatureCreatedPayload(payload);
    const existing = db.prepare("SELECT 1 FROM features WHERE id = ?").get(created.id);

    if (existing) {
      throw new Error(`Feature '${created.id}' already exists.`);
    }

    db.prepare(
      "INSERT INTO features (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run(created.id, created.title, created.status, timestamp, timestamp);
    return;
  }

  if (type === "feature.status_updated") {
    const updated = asFeatureStatusUpdatedPayload(payload);
    const result = db.prepare(
      "UPDATE features SET status = ?, updated_at = ? WHERE id = ?",
    ).run(updated.status, timestamp, updated.id);

    if (result.changes !== 1) {
      throw new Error(`Feature '${updated.id}' was not found.`);
    }
    return;
  }

  throw new Error(`Unsupported journal event type '${type}'.`);
}

async function writeEvent(
  db: DatabaseSync,
  actor: Actor,
  type: string,
  payload: EventPayload,
  options?: RecordEventOptions,
): Promise<void> {
  const timestamp = new Date().toISOString();

  db.exec("BEGIN TRANSACTION");
  try {
    db.prepare(
      "INSERT INTO events (timestamp, actor, type, payload) VALUES (?, ?, ?, ?)",
    ).run(timestamp, actor, type, JSON.stringify(payload));

    if (options?.faultInjection) {
      throw new Error("Fault injection: aborting journal transaction.");
    }

    applyProjection(db, type, payload, timestamp);
    db.exec("COMMIT TRANSACTION");
  } catch (error) {
    try {
      db.exec("ROLLBACK TRANSACTION");
    } catch {
      // A database-level ROLLBACK trigger may have already closed the transaction.
    }
    throw error;
  }
}

export async function recordEvent(
  db: DatabaseSync,
  actor: Actor,
  type: "feature.created" | "feature.status_updated",
  payload: EventPayload,
): Promise<void> {
  await writeEvent(db, actor, type, payload);
}

/** Test-only fault-injection seam; production callers must use recordEvent. */
export async function _recordEvent(
  db: DatabaseSync,
  actor: Actor,
  type: "feature.created" | "feature.status_updated",
  payload: EventPayload,
  options?: RecordEventOptions,
): Promise<void> {
  await writeEvent(db, actor, type, payload, options);
}

export async function createFeature(
  db: DatabaseSync,
  actor: Actor,
  id: string,
  title: string,
  status: string,
): Promise<FeatureProjection> {
  await recordEvent(db, actor, "feature.created", { id, title, status });
  return readFeature(db, id);
}

export async function updateFeatureStatus(
  db: DatabaseSync,
  actor: Actor,
  id: string,
  status: string,
): Promise<FeatureProjection> {
  await recordEvent(db, actor, "feature.status_updated", { id, status });
  return readFeature(db, id);
}

type JournalEvent = EventEnvelope<unknown> & { id: number };

type VerificationResult = {
  consistent: boolean;
  featureCount: number;
  eventCount: number;
  discrepancies: string[];
};

function payloadId(payload: unknown): string | undefined {
  return typeof payload === "object" && payload !== null && typeof (payload as { id?: unknown }).id === "string"
    ? (payload as { id: string }).id
    : undefined;
}

export async function readEvents(
  db: DatabaseSync,
  filter?: { featureId?: string },
): Promise<JournalEvent[]> {
  const rows = db.prepare(
    "SELECT id, timestamp, actor, type, payload FROM events ORDER BY id ASC",
  ).all() as Array<{ id: number; timestamp: string; actor: string; type: string; payload: string }>;

  const events = rows.map(row => ({
    id: row.id,
    timestamp: row.timestamp,
    actor: row.actor as Actor,
    type: row.type,
    payload: JSON.parse(row.payload) as unknown,
  }));

  return filter?.featureId === undefined
    ? events
    : events.filter(event => payloadId(event.payload) === filter.featureId);
}

export async function readFeatures(db: DatabaseSync): Promise<FeatureProjection[]> {
  return db.prepare(
    "SELECT id, title, status, created_at, updated_at FROM features ORDER BY id ASC",
  ).all() as unknown as FeatureProjection[];
}

export async function verifyDb(db: DatabaseSync): Promise<VerificationResult> {
  const events = await readEvents(db);
  const storedFeatures = await readFeatures(db);
  const expectedFeatures = new Map<string, FeatureProjection>();
  const discrepancies: string[] = [];

  for (const event of events) {
    try {
      if (event.type === "feature.created") {
        const payload = asFeatureCreatedPayload(event.payload);
        if (expectedFeatures.has(payload.id)) {
          discrepancies.push(`Invariant violation: feature '${payload.id}' has more than one feature.created event.`);
          continue;
        }
        expectedFeatures.set(payload.id, {
          id: payload.id,
          title: payload.title,
          status: payload.status,
          created_at: event.timestamp,
          updated_at: event.timestamp,
        });
      } else if (event.type === "feature.status_updated") {
        const payload = asFeatureStatusUpdatedPayload(event.payload);
        const feature = expectedFeatures.get(payload.id);
        if (!feature) {
          discrepancies.push(`Invariant violation: feature '${payload.id}' has a status update before creation.`);
          continue;
        }
        feature.status = payload.status;
        feature.updated_at = event.timestamp;
      } else if (!isWorkItemEventType(event.type)) {
        // Work-item events (see work-items.ts) share this journal but fall outside the
        // feature projection's replay scope entirely; they're not a discrepancy here.
        discrepancies.push(`Unsupported journal event type '${event.type}' at event ${event.id}.`);
      }
    } catch (error) {
      discrepancies.push(`Invalid event ${event.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const storedById = new Map(storedFeatures.map(feature => [feature.id, feature]));
  for (const [id, expected] of expectedFeatures) {
    const stored = storedById.get(id);
    if (!stored) {
      discrepancies.push(`Drift detected in feature '${id}': projection row is missing.`);
      continue;
    }
    for (const field of ["title", "status", "created_at", "updated_at"] as const) {
      if (stored[field] !== expected[field]) {
        discrepancies.push(
          `Drift detected in feature '${id}': field '${field}' has stored value '${stored[field]}' but replay derived '${expected[field]}'.`,
        );
      }
    }
  }

  for (const feature of storedFeatures) {
    if (!expectedFeatures.has(feature.id)) {
      discrepancies.push(
        `Invariant violation: feature '${feature.id}' exists in features projection table but has no corresponding feature.created event in the journal.`,
      );
    }
  }

  return {
    consistent: discrepancies.length === 0,
    featureCount: storedFeatures.length,
    eventCount: events.length,
    discrepancies,
  };
}

function escapeMarkdown(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function describeEvent(event: JournalEvent): string {
  if (event.type === "feature.created") {
    const payload = asFeatureCreatedPayload(event.payload);
    return `Created feature: ${payload.title}`;
  }
  if (event.type === "feature.status_updated") {
    const payload = asFeatureStatusUpdatedPayload(event.payload);
    return `Updated status to: \`${payload.status}\``;
  }
  return JSON.stringify(event.payload);
}

export async function exportFeatureJournal(db: DatabaseSync, featureId: string): Promise<string> {
  const events = await readEvents(db, { featureId });
  const creationEvent = events.find(event => event.type === "feature.created");

  if (!creationEvent) {
    throw new Error(`Error: No such feature '${featureId}'`);
  }

  const title = asFeatureCreatedPayload(creationEvent.payload).title;
  const rows = events.map(event => (
    `| ${escapeMarkdown(event.timestamp)} | ${escapeMarkdown(event.actor)} | \`${escapeMarkdown(event.type)}\` | ${escapeMarkdown(describeEvent(event))} |`
  ));

  return [
    `# Event Journal: ${title}`,
    "",
    `* **Feature ID**: \`${featureId}\``,
    "",
    "| Timestamp (UTC) | Actor | Event Type | Description / Detail |",
    "|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
}
