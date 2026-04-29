/**
 * PHN Lookup Mock API
 * Run with: deno run --allow-net --allow-read --allow-write main.ts
 *
 * Endpoints:
 *   GET /patient       - Resolve PHN from JWT 'sub' claim (HDID). Accepts ?hdid= for debug.
 *   PUT /patient       - Full replacement import of HDID-to-PHN mappings via YAML (replaces ALL data).
 *
 * YAML import format:
 *   - hdid: "P6FFO433A5WPMVTGM7T4ZVWBKCSVNAYGTWTU3J2LWMGUMERKI72A"
 *     phn: "9123456789"
 */

import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";
import { parse as parseYaml } from "jsr:@std/yaml";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PatientRow {
  hdid: string;
  phn: string;
}

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------

const DB_PATH = "./data/sqlite.db";

function openDb(): DB {
  try {
    Deno.mkdirSync("data", { recursive: true });
  } catch {
    // already exists
  }
  const db = new DB(DB_PATH);

  db.execute(`
    CREATE TABLE IF NOT EXISTS patients (
      hdid TEXT PRIMARY KEY,
      phn  TEXT NOT NULL
    );
  `);

  return db;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

function findPatientByHdid(db: DB, hdid: string): PatientRow | null {
  const rows = db.query<[string, string]>(
    "SELECT hdid, phn FROM patients WHERE hdid = ?",
    [hdid],
  );
  if (rows.length === 0) return null;
  const [rowHdid, phn] = rows[0];
  return { hdid: rowHdid, phn };
}

/**
 * Full replacement import — runs inside a single transaction:
 *   1. Delete all existing rows
 *   2. Insert the new dataset
 * Returns the number of records inserted.
 */
function replaceAllPatients(db: DB, patients: PatientRow[]): number {
  db.execute("BEGIN");
  try {
    db.execute("DELETE FROM patients");

    for (const p of patients) {
      db.query(
        "INSERT INTO patients (hdid, phn) VALUES (?, ?)",
        [p.hdid, p.phn],
      );
    }

    db.execute("COMMIT");
    return patients.length;
  } catch (err) {
    db.execute("ROLLBACK");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// YAML parsing & validation
// ---------------------------------------------------------------------------

type ParseOk = { valid: true; data: PatientRow[] };
type ParseErr = { valid: false; error: string };

const PHN_PATTERN = /^\d{10}$/;

function parseYamlPatients(yamlText: string): ParseOk | ParseErr {
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
    return { valid: false, error: "YAML must be an array of patient objects" };
  }

  if (parsed.length === 0) {
    return { valid: true, data: [] };
  }

  const validated: PatientRow[] = [];

  for (let r = 0; r < parsed.length; r++) {
    const row = parsed[r];
    const prefix = `Item ${r + 1}`;

    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      return { valid: false, error: `${prefix}: must be an object` };
    }

    const obj = row as Record<string, unknown>;

    if (typeof obj.hdid !== "string" || obj.hdid.trim() === "") {
      return { valid: false, error: `${prefix}: 'hdid' must be a non-empty string` };
    }
    const hdid = obj.hdid.trim();

    if (typeof obj.phn !== "string" || !PHN_PATTERN.test(obj.phn)) {
      return { valid: false, error: `${prefix}: 'phn' must be a 10-digit string` };
    }
    const phn = obj.phn;

    validated.push({ hdid, phn });
  }

  return { valid: true, data: validated };
}

// ---------------------------------------------------------------------------
// JWT decode (permissive — no signature verification)
// ---------------------------------------------------------------------------

/**
 * Extracts the 'sub' claim from the JWT in the Authorization header.
 * Does not verify the signature — this is a mock.
 * Returns null if the header is absent, malformed, or has no 'sub'.
 */
function extractSubFromAuthHeader(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return null;

  const segments = parts[1].split(".");
  if (segments.length < 2) return null;

  try {
    // Restore base64url padding before decoding
    const payload = segments[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const decoded = atob(padded);
    const claims = JSON.parse(decoded) as Record<string, unknown>;
    const sub = claims["sub"];
    return typeof sub === "string" && sub.trim() !== "" ? sub.trim() : null;
  } catch {
    return null;
  }
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

  // ── PUT /patient ─────────────────────────────────────────────────────────
  if (method === "PUT" && path === "/patient") {
    const body = await readText(req);
    if (body === null || body.trim() === "") {
      return json({ error: "Missing YAML body" }, 400);
    }

    const result = parseYamlPatients(body);
    if (!result.valid) return json({ error: result.error }, 400);

    const inserted = replaceAllPatients(db, result.data);
    return json({
      message: `Full replacement complete. ${inserted} record(s) imported.`,
      imported: inserted,
    });
  }

  // ── GET /patient ──────────────────────────────────────────────────────────
  if (method === "GET" && path === "/patient") {
    let hdid: string | null = url.searchParams.get("hdid")?.trim() || null;

    if (!hdid) {
      // Fall back to extracting the HDID from the JWT 'sub' claim
      const sub = extractSubFromAuthHeader(req);
      if (!sub) {
        return json(
          { error: "Unable to resolve HDID: no ?hdid= param and no decodable 'sub' in Bearer token." },
          400,
        );
      }
      hdid = sub;
    }

    const patient = findPatientByHdid(db, hdid);
    if (!patient) {
      return json({ error: `No patient found for HDID: ${hdid}` }, 404);
    }

    return json({ phn: patient.phn, hdid: patient.hdid });
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
  GET /patient              Resolve PHN from JWT 'sub' (HDID). Accepts ?hdid= for debug.
  PUT /patient              Full replacement import via YAML (replaces ALL existing data).

YAML import format (Content-Type: application/x-yaml):
  - hdid: "P6FFO433A5WPMVTGM7T4ZVWBKCSVNAYGTWTU3J2LWMGUMERKI72A"
    phn: "9123456789"
`);

Deno.serve({ port: PORT }, (req: Request) => handleRequest(req, db));
