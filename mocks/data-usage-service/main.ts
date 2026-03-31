/**
 * Activity REST API Server
 * Run with: deno run --allow-net --allow-read --allow-write main.ts
 *
 * Endpoints:
 *   GET /activities             - List all activities (supports ?limit=&offset=&subject=&date=)
 *   PUT /activities             - Full replacement import via YAML (replaces ALL data)
 *
 * YAML format:
 *   - eventId: abc-1
 *     eventTimeStamp: 2024-01-01T00:00:00Z
 *     subject: sample-subject
 *     message: Hello
 *     context:
 *       key: value
 */

import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";
import { parse as parseYaml } from "jsr:@std/yaml";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivityContext {
  [key: string]: string;
}

interface Activity {
  eventId: string;
  eventTimeStamp: string; // ISO-8601
  subject: string;
  message: string;
  context: ActivityContext;
}

type ActivityRow = [string, string, string, string, string]; // eventId, eventTimeStamp, subject, message, context_json
type DateFilter = "today" | "yesterday" | "this_month" | "last_month";

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------

const DB_PATH = "./data/sqlite.db";

function openDb(): DB {
  // Ensure /data directory exists
  try {
    Deno.mkdirSync("data", { recursive: true });
  } catch {
    // already exists
  }
  const db = new DB(DB_PATH);

  db.execute(`
    CREATE TABLE IF NOT EXISTS activities (
      eventId        TEXT PRIMARY KEY,
      eventTimeStamp TIMESTAMP NOT NULL,
      subject        TEXT NOT NULL DEFAULT '',
      message        TEXT NOT NULL,
      context        TEXT NOT NULL DEFAULT '{}'
    );
  `);

  return db;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

function rowToActivity([
  eventId,
  eventTimeStamp,
  subject,
  message,
  contextJson,
]: ActivityRow): Activity {
  return {
    eventId,
    eventTimeStamp,
    subject,
    message,
    context: JSON.parse(contextJson) as ActivityContext,
  };
}

function toIsoNoMillis(date: Date): string {
  return date.toISOString().replace(".000Z", "Z");
}

function dateRangeForFilter(filter: DateFilter): {
  start: string;
  end: string;
} {
  const now = new Date();
  const startOfTodayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  if (filter === "today") {
    const start = startOfTodayUtc;
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start: toIsoNoMillis(start), end: toIsoNoMillis(end) };
  }

  if (filter === "yesterday") {
    const end = startOfTodayUtc;
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 1);
    return { start: toIsoNoMillis(start), end: toIsoNoMillis(end) };
  }

  if (filter === "this_month") {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    return { start: toIsoNoMillis(start), end: toIsoNoMillis(end) };
  }

  if (filter === "last_month") {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
    );
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { start: toIsoNoMillis(start), end: toIsoNoMillis(end) };
  }
}

function listActivities(
  db: DB,
  limit = 100,
  offset = 0,
  subject?: string,
  date?: DateFilter,
): Activity[] {
  const whereClauses: string[] = [];
  const params: Array<string | number> = [];

  if (subject) {
    whereClauses.push("subject = ?");
    params.push(subject);
  }

  if (date) {
    const range = dateRangeForFilter(date);
    whereClauses.push("eventTimeStamp >= ? AND eventTimeStamp < ?");
    params.push(range.start, range.end);
  }

  const whereSql =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const rows = db.query<ActivityRow>(
    `SELECT eventId, eventTimeStamp, subject, message, context
     FROM activities
     ${whereSql}
     ORDER BY eventTimeStamp DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return rows.map(rowToActivity);
}

function countActivities(db: DB, subject?: string, date?: DateFilter): number {
  const whereClauses: string[] = [];
  const params: string[] = [];

  if (subject) {
    whereClauses.push("subject = ?");
    params.push(subject);
  }

  if (date) {
    const range = dateRangeForFilter(date);
    whereClauses.push("eventTimeStamp >= ? AND eventTimeStamp < ?");
    params.push(range.start, range.end);
  }

  const whereSql =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const rows = db.query<[number]>(
    `SELECT COUNT(*) FROM activities ${whereSql}`,
    params,
  );
  return rows[0][0];
}

/**
 * Full replacement import — runs inside a single transaction:
 *   1. Delete all existing rows
 *   2. Insert the new dataset
 * Returns the number of records inserted.
 */
function replaceAllActivities(db: DB, activities: Activity[]): number {
  db.execute("BEGIN");
  try {
    db.execute("DELETE FROM activities");

    for (const a of activities) {
      db.query(
        `INSERT INTO activities (eventId, eventTimeStamp, subject, message, context)
         VALUES (?, ?, ?, ?, ?)`,
        [
          a.eventId,
          a.eventTimeStamp,
          a.subject,
          a.message,
          JSON.stringify(a.context ?? {}),
        ],
      );
    }

    db.execute("COMMIT");
    return activities.length;
  } catch (err) {
    db.execute("ROLLBACK");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// YAML parsing & validation
// ---------------------------------------------------------------------------

type ParseOk = { valid: true; data: Activity[] };
type ParseErr = { valid: false; error: string };

function parseYamlActivities(yamlText: string): ParseOk | ParseErr {
  if (!yamlText || yamlText.trim() === "") {
    return { valid: false, error: "YAML body is empty" };
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(yamlText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `YAML parse failed: ${msg}` };
  }

  if (!Array.isArray(parsed)) {
    return { valid: false, error: "YAML must be an array of activity objects" };
  }

  if (parsed.length === 0) {
    return { valid: true, data: [] };
  }

  const validated: Activity[] = [];

  for (let r = 0; r < parsed.length; r++) {
    const row = parsed[r];
    const prefix = `Item ${r + 1}`;

    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      return { valid: false, error: `${prefix}: must be an object` };
    }

    const obj = row as Record<string, unknown>;

    let eventId = typeof obj.eventId === "string" ? obj.eventId.trim() : "";
    if (!eventId) {
      eventId = crypto.randomUUID();
    }

    const eventTimeStamp =
      typeof obj.eventTimeStamp === "string" ? obj.eventTimeStamp.trim() : "";
    if (!eventTimeStamp) {
      return {
        valid: false,
        error: `${prefix}: 'eventTimeStamp' must not be empty`,
      };
    }

    if (typeof obj.subject !== "string" || obj.subject.trim() === "") {
      return {
        valid: false,
        error: `${prefix}: 'subject' must be a non-empty string`,
      };
    }
    const subject = obj.subject.trim();

    if (typeof obj.message !== "string") {
      return {
        valid: false,
        error: `${prefix}: 'message' must be a string`,
      };
    }
    const message = obj.message;

    const contextValue = obj.context ?? {};
    if (
      typeof contextValue !== "object" ||
      Array.isArray(contextValue) ||
      contextValue === null
    ) {
      return {
        valid: false,
        error: `${prefix}: 'context' must be an object`,
      };
    }

    for (const [k, v] of Object.entries(
      contextValue as Record<string, unknown>,
    )) {
      if (typeof v !== "string") {
        return {
          valid: false,
          error: `${prefix}: context key '${k}' must have a string value`,
        };
      }
    }

    validated.push({
      eventId,
      eventTimeStamp,
      subject,
      message,
      context: contextValue as ActivityContext,
    });
  }

  // Catch duplicate eventIds within the payload
  const ids = validated.map((a) => a.eventId);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length > 0) {
    return {
      valid: false,
      error: `Duplicate eventIds in YAML: ${[...new Set(duplicates)].join(", ")}`,
    };
  }

  return { valid: true, data: validated };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function readText(req: Request): Promise<string | null> {
  try {
    return await req.text();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function handleRequest(req: Request, db: DB): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  const method = req.method.toUpperCase();

  // ── GET /activities ──────────────────────────────────────────────────────
  if (method === "GET" && path === "/activities") {
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") ?? "100"), 1),
      1000,
    );
    const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0"), 0);
    const subjectParam = url.searchParams.get("subject")?.trim();
    const subject =
      subjectParam && subjectParam !== "" ? subjectParam : undefined;
    const dateParamRaw = url.searchParams.get("date")?.trim().toLowerCase();
    let dateFilter: DateFilter | undefined;
    if (dateParamRaw && dateParamRaw !== "") {
      if (
        dateParamRaw !== "today" &&
        dateParamRaw !== "yesterday" &&
        dateParamRaw !== "this_month" &&
        dateParamRaw !== "last_month"
      ) {
        return json(
          {
            error:
              "Invalid 'date' filter. Allowed values: 'today', 'yesterday', 'this_month', 'last_month'",
          },
          400,
        );
      }
      dateFilter = dateParamRaw;
    }

    const data = listActivities(
      db,
      isNaN(limit) ? 100 : limit,
      isNaN(offset) ? 0 : offset,
      subject,
      dateFilter,
    );
    const total = countActivities(db, subject, dateFilter);
    return json({
      data,
    });
  }

  // ── PUT /activities ──────────────────────────────────────────────────────
  if (method === "PUT" && path === "/activities") {
    const body = await readText(req);
    if (body === null || body.trim() === "") {
      return json({ error: "Missing YAML body" }, 400);
    }

    const result = parseYamlActivities(body);
    if (!result.valid) return json({ error: result.error }, 400);

    const inserted = replaceAllActivities(db, result.data);
    return json({
      message: `Full replacement complete. ${inserted} record(s) imported.`,
      imported: inserted,
    });
  }

  return json({ error: "Route not found" }, 404);
}

// ---------------------------------------------------------------------------
// Server entry point
// ---------------------------------------------------------------------------

const PORT = 8000;
const db = openDb();

console.log(`Database : ${DB_PATH}`);
console.log(`Listening: http://localhost:${PORT}`);
console.log(`
Endpoints:
  GET /activities              List all activities  (?limit=100&offset=0&subject=foo&date=today)
  PUT /activities              Full replacement import via YAML (replaces ALL existing data)

YAML format (Content-Type: text/yaml or application/x-yaml):
  - eventId: abc-1
    eventTimeStamp: 2024-01-01T00:00:00Z
    subject: sample-subject
    message: Hello
    context:
      key: value
`);

Deno.serve({ port: PORT }, (req: Request) => handleRequest(req, db));
