/**
 * My Self Serve Mock API
 *
 * Run with:
 *   deno run --allow-net --allow-read --allow-write main.ts
 *
 * Implemented endpoints:
 *   GET  /health
 *   PUT  /data
 *
 *   GET  /service-requests
 *   POST /service-requests
 *   GET  /service-requests/eligible-types
 *   GET  /service-requests/{sr_id}
 *   GET  /service-requests/{sr_id}/draft
 *   GET  /service-requests/{sr_id}/form
 *   PUT  /service-requests/{sr_id}/form
 *   POST /service-requests/{sr_id}/submit
 *   POST /service-requests/{sr_id}/withdraw
 *
 *   GET   /account/profile
 *   PATCH /account/contact
 *   GET   /account/case-members
 *   POST  /account/post-login-sync
 *
 * Everything else returns:
 *   501 Not Implemented
 */

import { createHash } from "node:crypto";
import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";
import { parse as parseYaml } from "jsr:@std/yaml";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type JsonObject = Record<string, unknown>;

type SRType =
  | "ASSIST"
  | "RREINSTATE"
  | "CRISIS_FOOD"
  | "CRISIS_SHELTER"
  | "CRISIS_CLOTHING"
  | "CRISIS_UTILITIES"
  | "CRISIS_MED_TRANSPORT"
  | "DIRECT_DEPOSIT"
  | "DIET"
  | "NATAL"
  | "MED_TRANSPORT_LOCAL"
  | "MED_TRANSPORT_NON_LOCAL"
  | "RECONSIDERATION"
  | "RECON_SUPPLEMENT"
  | "RECON_EXTENSION"
  | "STREAMLINED"
  | "BUS_PASS"
  | "PWD_DESIGNATION"
  | "PPMB";

interface ServiceRequestRow {
  sr_id: string;
  subject: string;
  bceid_guid: string;
  sr_type: SRType;
  sr_number: string;
  status: string;
  client_name: string;
  created_at: string;
  updated_at: string;
  draft_json: JsonObject | null;
  answers_json: JsonObject | null;
  attachments: string[];
  submitted_at: string | null;
  withdrawn_at: string | null;
}

interface AccountRow {
  subject: string;
  bceid_guid: string;
  user_id: string;
  email: string | null;
  phone_numbers: JsonObject[];
  case_number: string;
  case_status: string;
  case_members: JsonObject[];
}

interface ImportedServiceRequest {
  sr_id?: unknown;
  subject?: unknown;
  bceid_guid?: unknown;
  sr_type?: unknown;
  sr_number?: unknown;
  status?: unknown;
  client_name?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  draft_json?: unknown;
  answers_json?: unknown;
  attachments?: unknown;
  submitted_at?: unknown;
  withdrawn_at?: unknown;
}

interface ImportedAccount {
  subject?: unknown;
  bceid_guid?: unknown;
  client_name?: unknown;
  user_id?: unknown;
  email?: unknown;
  phone_numbers?: unknown;
  case_number?: unknown;
  case_status?: unknown;
  case_members?: unknown;
}

interface MockClaims {
  sub?: string;
  role?: string;
  bceid_guid?: string;
  idir_username?: string;
}

interface ImportData {
  serviceRequests: ServiceRequestRow[];
  accounts: AccountRow[];
}

type ParseOk = { valid: true; data: ImportData };
type ParseErr = { valid: false; error: string };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DB_PATH = "./data/sqlite.db";
const PORT = 8000;
const VALID_PIN = "1234";

const SR_TYPES: SRType[] = [
  "ASSIST",
  "RREINSTATE",
  "CRISIS_FOOD",
  "CRISIS_SHELTER",
  "CRISIS_CLOTHING",
  "CRISIS_UTILITIES",
  "CRISIS_MED_TRANSPORT",
  "DIRECT_DEPOSIT",
  "DIET",
  "NATAL",
  "MED_TRANSPORT_LOCAL",
  "MED_TRANSPORT_NON_LOCAL",
  "RECONSIDERATION",
  "RECON_SUPPLEMENT",
  "RECON_EXTENSION",
  "STREAMLINED",
  "BUS_PASS",
  "PWD_DESIGNATION",
  "PPMB",
];

const SR_TYPE_DISPLAY_NAMES: Record<SRType, string> = {
  ASSIST: "Assistance Request",
  RREINSTATE: "Reinstatement Request",
  CRISIS_FOOD: "Crisis Supplement - Food",
  CRISIS_SHELTER: "Crisis Supplement - Shelter",
  CRISIS_CLOTHING: "Crisis Supplement - Clothing",
  CRISIS_UTILITIES: "Crisis Supplement - Utilities",
  CRISIS_MED_TRANSPORT: "Crisis Supplement - Medical Transportation",
  DIRECT_DEPOSIT: "Direct Deposit",
  DIET: "Diet Supplement",
  NATAL: "Natal Supplement",
  MED_TRANSPORT_LOCAL: "Medical Transportation - Local",
  MED_TRANSPORT_NON_LOCAL: "Medical Transportation - Non-local",
  RECONSIDERATION: "Reconsideration",
  RECON_SUPPLEMENT: "Reconsideration - Supplement",
  RECON_EXTENSION: "Reconsideration - Extension",
  STREAMLINED: "Streamlined Application",
  BUS_PASS: "Bus Pass",
  PWD_DESIGNATION: "PWD Designation",
  PPMB: "PPMB",
};

// ---------------------------------------------------------------------------
// Identity helpers
// ---------------------------------------------------------------------------

function md5UpperNoDash(value: string): string {
  return createHash("md5").update(value).digest("hex").toUpperCase();
}

function subjectFromClientName(clientName: string): string {
  return md5UpperNoDash(clientName.trim());
}

function bceidGuidFromClientName(clientName: string): string {
  return `BCEID:${clientName.trim()}`;
}

function subjectFromClaims(claims: MockClaims): string | null {
  // Client data is scoped by the token subject.
  //
  // The bceid_guid claim is recorded as data only. It is not used to authorize
  // or match client-scoped requests in this mock.
  if (claims.sub && claims.sub.trim() !== "") {
    return claims.sub.trim();
  }

  return null;
}

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------

function openDb(): DB {
  try {
    Deno.mkdirSync("data", { recursive: true });
  } catch {
    // Directory already exists.
  }

  const db = new DB(DB_PATH);

  db.execute(`
    CREATE TABLE IF NOT EXISTS service_requests (
      sr_id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      bceid_guid TEXT NOT NULL,
      sr_type TEXT NOT NULL,
      sr_number TEXT NOT NULL,
      status TEXT NOT NULL,
      client_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      draft_json TEXT,
      answers_json TEXT,
      attachments_json TEXT NOT NULL DEFAULT '[]',
      submitted_at TEXT,
      withdrawn_at TEXT
    );
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS accounts (
      subject TEXT PRIMARY KEY,
      bceid_guid TEXT NOT NULL,
      user_id TEXT NOT NULL,
      email TEXT,
      phone_numbers_json TEXT NOT NULL DEFAULT '[]',
      case_number TEXT NOT NULL,
      case_status TEXT NOT NULL,
      case_members_json TEXT NOT NULL DEFAULT '[]'
    );
  `);

  ensureIdentityColumns(db);

  return db;
}

function hasColumn(db: DB, tableName: string, columnName: string): boolean {
  const columns = db.query<
    [number, string, string, number, string | null, number]
  >(
    `PRAGMA table_info(${tableName})`,
  );

  return columns.some((column) => column[1] === columnName);
}

function ensureIdentityColumns(db: DB): void {
  if (!hasColumn(db, "service_requests", "subject")) {
    db.execute("ALTER TABLE service_requests ADD COLUMN subject TEXT");
  }

  if (!hasColumn(db, "service_requests", "bceid_guid")) {
    db.execute("ALTER TABLE service_requests ADD COLUMN bceid_guid TEXT");
  }

  db.query<[string, string]>(
    "SELECT sr_id, client_name FROM service_requests WHERE subject IS NULL OR subject = ''",
  ).forEach(([srId, clientName]) => {
    db.query(
      "UPDATE service_requests SET subject = ? WHERE sr_id = ?",
      [subjectFromClientName(clientName), srId],
    );
  });

  db.query<[string, string]>(
    "SELECT sr_id, client_name FROM service_requests WHERE bceid_guid IS NULL OR bceid_guid = ''",
  ).forEach(([srId, clientName]) => {
    db.query(
      "UPDATE service_requests SET bceid_guid = ? WHERE sr_id = ?",
      [bceidGuidFromClientName(clientName), srId],
    );
  });

  if (!hasColumn(db, "accounts", "subject")) {
    db.execute("ALTER TABLE accounts ADD COLUMN subject TEXT");
  }

  if (!hasColumn(db, "accounts", "bceid_guid")) {
    db.execute("ALTER TABLE accounts ADD COLUMN bceid_guid TEXT");
  }

  db.query<[string, string]>(
    "SELECT bceid_guid, user_id FROM accounts WHERE subject IS NULL OR subject = ''",
  ).forEach(([bceidGuid, userId]) => {
    db.query(
      "UPDATE accounts SET subject = ? WHERE bceid_guid = ?",
      [subjectFromClientName(userId), bceidGuid],
    );
  });

  db.query<[string, string]>(
    "SELECT subject, user_id FROM accounts WHERE bceid_guid IS NULL OR bceid_guid = ''",
  ).forEach(([subject, userId]) => {
    db.query(
      "UPDATE accounts SET bceid_guid = ? WHERE subject = ?",
      [bceidGuidFromClientName(userId), subject],
    );
  });
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

function toJsonText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

function parseJsonObject(value: string | null): JsonObject | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as JsonObject;
    }
    return {};
  } catch {
    return {};
  }
}

function parseJsonStringArray(value: string | null): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function parseJsonObjectArray(value: string | null): JsonObject[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is JsonObject => isObject(item));
  } catch {
    return [];
  }
}

function mapServiceRequestRow(row: [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
]): ServiceRequestRow {
  const [
    sr_id,
    subject,
    bceid_guid,
    sr_type,
    sr_number,
    status,
    client_name,
    created_at,
    updated_at,
    draft_json,
    answers_json,
    attachments_json,
    submitted_at,
    withdrawn_at,
  ] = row;

  return {
    sr_id,
    subject,
    bceid_guid,
    sr_type: sr_type as SRType,
    sr_number,
    status,
    client_name,
    created_at,
    updated_at,
    draft_json: parseJsonObject(draft_json),
    answers_json: parseJsonObject(answers_json),
    attachments: parseJsonStringArray(attachments_json),
    submitted_at,
    withdrawn_at,
  };
}

function mapAccountRow(row: [
  string,
  string,
  string,
  string | null,
  string | null,
  string,
  string,
  string | null,
]): AccountRow {
  const [
    subject,
    bceid_guid,
    user_id,
    email,
    phone_numbers_json,
    case_number,
    case_status,
    case_members_json,
  ] = row;

  return {
    subject,
    bceid_guid,
    user_id,
    email,
    phone_numbers: parseJsonObjectArray(phone_numbers_json),
    case_number,
    case_status,
    case_members: parseJsonObjectArray(case_members_json),
  };
}

function findServiceRequestById(
  db: DB,
  srId: string,
  subject: string,
): ServiceRequestRow | null {
  const rows = db.query<[
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string | null,
    string | null,
    string | null,
    string | null,
    string | null,
  ]>(
    `
      SELECT
        sr_id,
        subject,
        bceid_guid,
        sr_type,
        sr_number,
        status,
        client_name,
        created_at,
        updated_at,
        draft_json,
        answers_json,
        attachments_json,
        submitted_at,
        withdrawn_at
      FROM service_requests
      WHERE sr_id = ?
        AND subject = ?
    `,
    [srId, subject],
  );

  if (rows.length === 0) return null;
  return mapServiceRequestRow(rows[0]);
}

function findAccountBySubject(
  db: DB,
  subject: string,
): AccountRow | null {
  const rows = db.query<[
    string,
    string,
    string,
    string | null,
    string | null,
    string,
    string,
    string | null,
  ]>(
    `
      SELECT
        subject,
        bceid_guid,
        user_id,
        email,
        phone_numbers_json,
        case_number,
        case_status,
        case_members_json
      FROM accounts
      WHERE subject = ?
    `,
    [subject],
  );

  if (rows.length === 0) return null;
  return mapAccountRow(rows[0]);
}

function listServiceRequests(
  db: DB,
  subject: string,
  page: number,
  pageSize: number,
): { items: ServiceRequestRow[]; total: number } {
  const totalRows = db.query<[number]>(
    "SELECT COUNT(*) FROM service_requests WHERE subject = ?",
    [subject],
  );
  const total = totalRows[0]?.[0] ?? 0;

  const offset = (page - 1) * pageSize;

  const rows = db.query<[
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string | null,
    string | null,
    string | null,
    string | null,
    string | null,
  ]>(
    `
      SELECT
        sr_id,
        subject,
        bceid_guid,
        sr_type,
        sr_number,
        status,
        client_name,
        created_at,
        updated_at,
        draft_json,
        answers_json,
        attachments_json,
        submitted_at,
        withdrawn_at
      FROM service_requests
      WHERE subject = ?
      ORDER BY datetime(created_at) DESC, sr_id ASC
      LIMIT ? OFFSET ?
    `,
    [subject, pageSize, offset],
  );

  return {
    total,
    items: rows.map(mapServiceRequestRow),
  };
}

function hasActiveServiceRequestOfType(
  db: DB,
  subject: string,
  srType: SRType,
): boolean {
  const rows = db.query<[number]>(
    `
      SELECT COUNT(*)
      FROM service_requests
      WHERE subject = ?
        AND sr_type = ?
        AND status NOT IN ('Submitted', 'Withdrawn', 'Cancelled', 'Completed', 'Declined')
    `,
    [subject, srType],
  );

  return (rows[0]?.[0] ?? 0) > 0;
}

function insertServiceRequest(db: DB, row: ServiceRequestRow): void {
  db.query(
    `
      INSERT INTO service_requests (
        sr_id,
        subject,
        bceid_guid,
        sr_type,
        sr_number,
        status,
        client_name,
        created_at,
        updated_at,
        draft_json,
        answers_json,
        attachments_json,
        submitted_at,
        withdrawn_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      row.sr_id,
      row.subject,
      row.bceid_guid,
      row.sr_type,
      row.sr_number,
      row.status,
      row.client_name,
      row.created_at,
      row.updated_at,
      toJsonText(row.draft_json),
      toJsonText(row.answers_json),
      JSON.stringify(row.attachments),
      row.submitted_at,
      row.withdrawn_at,
    ],
  );
}

function insertAccount(db: DB, row: AccountRow): void {
  db.query(
    `
      INSERT INTO accounts (
        subject,
        bceid_guid,
        user_id,
        email,
        phone_numbers_json,
        case_number,
        case_status,
        case_members_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      row.subject,
      row.bceid_guid,
      row.user_id,
      row.email,
      JSON.stringify(row.phone_numbers),
      row.case_number,
      row.case_status,
      JSON.stringify(row.case_members),
    ],
  );
}

function updateAccountContact(
  db: DB,
  subject: string,
  email: string | null | undefined,
  phoneNumbers: JsonObject[] | undefined,
): AccountRow | null {
  const account = findAccountBySubject(db, subject);

  if (!account) {
    return null;
  }

  const nextEmail = email !== undefined ? email : account.email;
  const nextPhoneNumbers = phoneNumbers !== undefined
    ? phoneNumbers
    : account.phone_numbers;

  db.query(
    `
      UPDATE accounts
      SET email = ?,
          phone_numbers_json = ?
      WHERE subject = ?
    `,
    [
      nextEmail,
      JSON.stringify(nextPhoneNumbers),
      subject,
    ],
  );

  return findAccountBySubject(db, subject);
}

function updateServiceRequestForm(
  db: DB,
  srId: string,
  subject: string,
  draftJson: JsonObject,
  answersJson: JsonObject,
): ServiceRequestRow | null {
  const updatedAt = new Date().toISOString();

  db.query(
    `
      UPDATE service_requests
      SET draft_json = ?,
          answers_json = ?,
          updated_at = ?
      WHERE sr_id = ?
        AND subject = ?
    `,
    [
      JSON.stringify(draftJson),
      JSON.stringify(answersJson),
      updatedAt,
      srId,
      subject,
    ],
  );

  return findServiceRequestById(db, srId, subject);
}

function submitServiceRequest(
  db: DB,
  srId: string,
  subject: string,
): ServiceRequestRow | null {
  const now = new Date().toISOString();

  db.query(
    `
      UPDATE service_requests
      SET status = 'Submitted',
          submitted_at = ?,
          updated_at = ?
      WHERE sr_id = ?
        AND subject = ?
    `,
    [now, now, srId, subject],
  );

  return findServiceRequestById(db, srId, subject);
}

function withdrawServiceRequest(
  db: DB,
  srId: string,
  subject: string,
): ServiceRequestRow | null {
  const now = new Date().toISOString();

  db.query(
    `
      UPDATE service_requests
      SET status = 'Withdrawn',
          withdrawn_at = ?,
          updated_at = ?
      WHERE sr_id = ?
        AND subject = ?
    `,
    [now, now, srId, subject],
  );

  return findServiceRequestById(db, srId, subject);
}

function replaceAllData(
  db: DB,
  data: ImportData,
): { serviceRequests: number; accounts: number } {
  db.execute("BEGIN");

  try {
    db.execute("DELETE FROM service_requests");
    db.execute("DELETE FROM accounts");

    for (const account of data.accounts) {
      insertAccount(db, account);
    }

    for (const sr of data.serviceRequests) {
      insertServiceRequest(db, sr);
    }

    db.execute("COMMIT");

    return {
      serviceRequests: data.serviceRequests.length,
      accounts: data.accounts.length,
    };
  } catch (err) {
    db.execute("ROLLBACK");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// YAML parsing & validation
// ---------------------------------------------------------------------------

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSRType(value: unknown): value is SRType {
  return typeof value === "string" && SR_TYPES.includes(value as SRType);
}

function stringOrDefault(value: unknown, defaultValue: string): string {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : defaultValue;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function stringOrDefaultNullable(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function jsonObjectOrNull(value: unknown): JsonObject | null {
  if (value === null || value === undefined) return null;
  return isObject(value) ? value : {};
}

function stringArrayOrDefault(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

function objectArrayOrDefault(value: unknown): JsonObject[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is JsonObject => isObject(item));
}

function parseYamlData(yamlText: string): ParseOk | ParseErr {
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

  if (!isObject(parsed)) {
    return {
      valid: false,
      error: "YAML must be an object",
    };
  }

  const serviceRequests = parsed.service_requests ?? [];
  const accounts = parsed.accounts ?? [];

  if (!Array.isArray(serviceRequests)) {
    return {
      valid: false,
      error: "YAML 'service_requests' must be an array",
    };
  }

  if (!Array.isArray(accounts)) {
    return {
      valid: false,
      error: "YAML 'accounts' must be an array",
    };
  }

  const accountRows: AccountRow[] = [];

  for (let index = 0; index < accounts.length; index++) {
    const item = accounts[index] as ImportedAccount;
    const prefix = `accounts[${index}]`;

    if (!isObject(item)) {
      return { valid: false, error: `${prefix}: must be an object` };
    }

    const clientName = stringOrDefault(
      item.client_name,
      stringOrDefault(item.user_id, "Mock Client"),
    );
    const subject = stringOrDefault(
      item.subject,
      subjectFromClientName(clientName),
    );
    const bceidGuid = stringOrDefault(
      item.bceid_guid,
      bceidGuidFromClientName(clientName),
    );

    accountRows.push({
      subject,
      bceid_guid: bceidGuid,
      user_id: stringOrDefault(item.user_id, clientName),
      email: stringOrNull(item.email),
      phone_numbers: objectArrayOrDefault(item.phone_numbers),
      case_number: stringOrDefault(item.case_number, `CASE-${index + 1}`),
      case_status: stringOrDefault(item.case_status, "OPEN"),
      case_members: objectArrayOrDefault(item.case_members),
    });
  }

  const serviceRequestRows: ServiceRequestRow[] = [];

  for (let index = 0; index < serviceRequests.length; index++) {
    const item = serviceRequests[index] as ImportedServiceRequest;
    const prefix = `service_requests[${index}]`;

    if (!isObject(item)) {
      return { valid: false, error: `${prefix}: must be an object` };
    }

    if (!isSRType(item.sr_type)) {
      return {
        valid: false,
        error: `${prefix}: 'sr_type' must be one of: ${SR_TYPES.join(", ")}`,
      };
    }

    const now = new Date().toISOString();
    const clientName = stringOrDefault(item.client_name, "Mock Client");
    const srId = stringOrDefault(item.sr_id, crypto.randomUUID());
    const srNumber = stringOrDefault(item.sr_number, generateSrNumber());
    const createdAt = stringOrDefault(item.created_at, now);
    const updatedAt = stringOrDefault(item.updated_at, createdAt);
    const subject = stringOrDefault(
      item.subject,
      subjectFromClientName(clientName),
    );
    const bceidGuid = stringOrDefault(
      item.bceid_guid,
      bceidGuidFromClientName(clientName),
    );

    serviceRequestRows.push({
      sr_id: srId,
      subject,
      bceid_guid: bceidGuid,
      sr_type: item.sr_type,
      sr_number: srNumber,
      status: stringOrDefault(item.status, "Draft"),
      client_name: clientName,
      created_at: createdAt,
      updated_at: updatedAt,
      draft_json: jsonObjectOrNull(item.draft_json),
      answers_json: jsonObjectOrNull(item.answers_json),
      attachments: stringArrayOrDefault(item.attachments),
      submitted_at: stringOrDefaultNullable(item.submitted_at),
      withdrawn_at: stringOrDefaultNullable(item.withdrawn_at),
    });
  }

  return {
    valid: true,
    data: {
      serviceRequests: serviceRequestRows,
      accounts: accountRows,
    },
  };
}

// ---------------------------------------------------------------------------
// JWT decode
// ---------------------------------------------------------------------------

function extractClaimsFromAuthHeader(req: Request): MockClaims | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return null;

  const segments = parts[1].split(".");
  if (segments.length < 2) return null;

  try {
    const payload = segments[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const decoded = atob(padded);
    const claims = JSON.parse(decoded) as Record<string, unknown>;

    return {
      sub: typeof claims.sub === "string" ? claims.sub : undefined,
      role: typeof claims.role === "string" ? claims.role : undefined,
      bceid_guid: typeof claims.bceid_guid === "string"
        ? claims.bceid_guid
        : undefined,
      idir_username: typeof claims.idir_username === "string"
        ? claims.idir_username
        : undefined,
    };
  } catch {
    return null;
  }
}

function requireClaims(req: Request): MockClaims | Response {
  const claims = extractClaimsFromAuthHeader(req);

  if (!claims) {
    return json(
      { detail: "Missing or invalid authentication token" },
      401,
    );
  }

  return claims;
}

function requireSubject(claims: MockClaims): string | Response {
  const subject = subjectFromClaims(claims);

  if (!subject) {
    return json(
      { detail: "Missing sub claim" },
      401,
    );
  }

  return subject;
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function empty(status: number): Response {
  return new Response(null, { status });
}

async function readText(req: Request): Promise<string | null> {
  try {
    return await req.text();
  } catch {
    return null;
  }
}

async function readJsonObject(req: Request): Promise<JsonObject | null> {
  try {
    const body = await req.json();
    return isObject(body) ? body : null;
  } catch {
    return null;
  }
}

function getPositiveIntParam(
  url: URL,
  name: string,
  defaultValue: number,
  maxValue?: number,
): number {
  const raw = url.searchParams.get(name);
  const parsed = raw ? Number.parseInt(raw, 10) : defaultValue;

  if (!Number.isFinite(parsed) || parsed < 1) return defaultValue;
  if (maxValue !== undefined && parsed > maxValue) return maxValue;

  return parsed;
}

function generateSrNumber(): string {
  const suffix = Math.floor(100000 + Math.random() * 900000);
  return `SR-${suffix}`;
}

function toSummary(sr: ServiceRequestRow): JsonObject {
  return {
    sr_id: sr.sr_id,
    sr_type: sr.sr_type,
    sr_number: sr.sr_number,
    status: sr.status,
    client_name: sr.client_name,
    created_at: sr.created_at,
  };
}

function toDraftResponse(sr: ServiceRequestRow): JsonObject {
  return {
    sr_id: sr.sr_id,
    sr_type: sr.sr_type,
    draft_json: sr.draft_json,
    updated_at: sr.updated_at,
  };
}

function toDetailResponse(sr: ServiceRequestRow): JsonObject {
  return {
    sr_id: sr.sr_id,
    sr_type: sr.sr_type,
    sr_number: sr.sr_number,
    status: sr.status,
    client_name: sr.client_name,
    created_at: sr.created_at,
    answers: sr.answers_json,
    attachments: sr.attachments,
  };
}

function toProfileResponse(account: AccountRow): JsonObject {
  return {
    user_id: account.user_id,
    email: account.email,
    phone_numbers: account.phone_numbers,
    case_number: account.case_number,
    case_status: account.case_status,
  };
}

function notImplemented(): Response {
  return json({ detail: "Not implemented in this mock" }, 501);
}

// ---------------------------------------------------------------------------
// Dynamic forms
// ---------------------------------------------------------------------------

function buildDynamicFormSchema(srType: SRType): JsonObject {
  const displayName = SR_TYPE_DISPLAY_NAMES[srType];

  if (srType === "BUS_PASS") {
    return {
      form_type: "SR",
      sr_type: srType,
      total_pages: 2,
      pages: [
        {
          page_index: 0,
          title: "Bus pass request",
          fields: [
            {
              field_id: "needs_bus_pass",
              label: "Do you need a bus pass?",
              field_type: "checkbox",
              required: true,
            },
            {
              field_id: "reason",
              label: "Reason for request",
              field_type: "textarea",
              required: false,
            },
          ],
        },
        {
          page_index: 1,
          title: "Review and submit",
          fields: [
            {
              field_id: "declaration",
              label: "I confirm this information is correct",
              field_type: "checkbox",
              required: true,
            },
          ],
        },
      ],
    };
  }

  if (srType.startsWith("CRISIS_")) {
    return {
      form_type: "SR",
      sr_type: srType,
      total_pages: 2,
      pages: [
        {
          page_index: 0,
          title: displayName,
          fields: [
            {
              field_id: "amount_requested",
              label: "Amount requested",
              field_type: "number",
              required: true,
            },
            {
              field_id: "crisis_description",
              label: "Describe your situation",
              field_type: "textarea",
              required: true,
            },
          ],
        },
        {
          page_index: 1,
          title: "Review and submit",
          fields: [
            {
              field_id: "declaration",
              label: "I confirm this information is correct",
              field_type: "checkbox",
              required: true,
            },
          ],
        },
      ],
    };
  }

  return {
    form_type: "SR",
    sr_type: srType,
    total_pages: 2,
    pages: [
      {
        page_index: 0,
        title: displayName,
        fields: [
          {
            field_id: "description",
            label: "Tell us about your request",
            field_type: "textarea",
            required: true,
          },
        ],
      },
      {
        page_index: 1,
        title: "Review and submit",
        fields: [
          {
            field_id: "declaration",
            label: "I confirm this information is correct",
            field_type: "checkbox",
            required: true,
          },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleDataImport(req: Request, db: DB): Promise<Response> {
  const body = await readText(req);

  if (body === null || body.trim() === "") {
    return json({ detail: "Missing YAML body" }, 400);
  }

  const result = parseYamlData(body);

  if (!result.valid) {
    return json({ detail: result.error }, 400);
  }

  const imported = replaceAllData(db, result.data);

  return json({
    message:
      `Full replacement complete. ${imported.serviceRequests} service request record(s) and ${imported.accounts} account record(s) imported.`,
    imported,
  });
}

function handleListServiceRequests(
  url: URL,
  db: DB,
  claims: MockClaims,
): Response {
  const subjectOrResponse = requireSubject(claims);

  if (isResponse(subjectOrResponse)) {
    return subjectOrResponse;
  }

  const page = getPositiveIntParam(url, "page", 1);
  const pageSize = getPositiveIntParam(url, "page_size", 20, 100);

  const result = listServiceRequests(db, subjectOrResponse, page, pageSize);

  return json({
    items: result.items.map(toSummary),
    total: result.total,
    page,
    page_size: pageSize,
  });
}

async function handleCreateServiceRequest(
  req: Request,
  db: DB,
  claims: MockClaims,
): Promise<Response> {
  const subjectOrResponse = requireSubject(claims);

  if (isResponse(subjectOrResponse)) {
    return subjectOrResponse;
  }

  const body = await readJsonObject(req);

  if (!body) {
    return json({ detail: "Request body must be a JSON object" }, 400);
  }

  if (!isSRType(body.sr_type)) {
    return json(
      { detail: `'sr_type' must be one of: ${SR_TYPES.join(", ")}` },
      422,
    );
  }

  if (hasActiveServiceRequestOfType(db, subjectOrResponse, body.sr_type)) {
    return json(
      { detail: "Active SR of this type already exists" },
      409,
    );
  }

  const now = new Date().toISOString();

  const sr: ServiceRequestRow = {
    sr_id: crypto.randomUUID(),
    subject: subjectOrResponse,
    bceid_guid: claims.bceid_guid && claims.bceid_guid.trim() !== ""
      ? claims.bceid_guid.trim()
      : bceidGuidFromClientName("Mock Client"),
    sr_type: body.sr_type,
    sr_number: generateSrNumber(),
    status: "Draft",
    client_name: "Mock Client",
    created_at: now,
    updated_at: now,
    draft_json: {
      page_index: 0,
      answers: {},
    },
    answers_json: {},
    attachments: [],
    submitted_at: null,
    withdrawn_at: null,
  };

  insertServiceRequest(db, sr);

  return json(toDraftResponse(sr), 201);
}

function handleEligibleTypes(): Response {
  return json(
    SR_TYPES.map((srType) => ({
      sr_type: srType,
      display_name: SR_TYPE_DISPLAY_NAMES[srType],
      requires_pin: true,
      has_attachments: srType !== "BUS_PASS",
      max_active: 1,
    })),
  );
}

function handleGetServiceRequest(
  db: DB,
  claims: MockClaims,
  srId: string,
): Response {
  const subjectOrResponse = requireSubject(claims);

  if (isResponse(subjectOrResponse)) {
    return subjectOrResponse;
  }

  const sr = findServiceRequestById(db, srId, subjectOrResponse);

  if (!sr) {
    return json({ detail: "Service request not found" }, 404);
  }

  return json(toDetailResponse(sr));
}

function handleGetServiceRequestDraft(
  db: DB,
  claims: MockClaims,
  srId: string,
): Response {
  const subjectOrResponse = requireSubject(claims);

  if (isResponse(subjectOrResponse)) {
    return subjectOrResponse;
  }

  const sr = findServiceRequestById(db, srId, subjectOrResponse);

  if (!sr || sr.status !== "Draft") {
    return json({ detail: "Draft not found" }, 404);
  }

  return json(toDraftResponse(sr));
}

function handleGetServiceRequestForm(
  url: URL,
  db: DB,
  claims: MockClaims,
  srId: string,
): Response {
  const subjectOrResponse = requireSubject(claims);

  if (isResponse(subjectOrResponse)) {
    return subjectOrResponse;
  }

  const sr = findServiceRequestById(db, srId, subjectOrResponse);

  if (!sr) {
    return json({ detail: "Form schema not found" }, 404);
  }

  const requestedType = url.searchParams.get("sr_type");
  const srType = isSRType(requestedType) ? requestedType : sr.sr_type;

  return json(buildDynamicFormSchema(srType));
}

async function handleUpdateServiceRequestForm(
  req: Request,
  db: DB,
  claims: MockClaims,
  srId: string,
): Promise<Response> {
  const subjectOrResponse = requireSubject(claims);

  if (isResponse(subjectOrResponse)) {
    return subjectOrResponse;
  }

  const sr = findServiceRequestById(db, srId, subjectOrResponse);

  if (!sr || sr.status !== "Draft") {
    return json({ detail: "Draft not found" }, 404);
  }

  const body = await readJsonObject(req);

  if (!body) {
    return json({ detail: "Request body must be a JSON object" }, 400);
  }

  const answers = isObject(body.answers) ? body.answers : {};
  const pageIndex = typeof body.page_index === "number" ? body.page_index : 0;

  const draftJson = {
    page_index: pageIndex,
    answers,
  };

  const updated = updateServiceRequestForm(
    db,
    srId,
    subjectOrResponse,
    draftJson,
    answers,
  );

  if (!updated) {
    return json({ detail: "Draft not found" }, 404);
  }

  return json(toDraftResponse(updated));
}

async function handleSubmitServiceRequest(
  req: Request,
  db: DB,
  claims: MockClaims,
  srId: string,
): Promise<Response> {
  const subjectOrResponse = requireSubject(claims);

  if (isResponse(subjectOrResponse)) {
    return subjectOrResponse;
  }

  const sr = findServiceRequestById(db, srId, subjectOrResponse);

  if (!sr) {
    return json({ detail: "Service request not found" }, 404);
  }

  const body = await readJsonObject(req);

  if (!body) {
    return json({ detail: "Request body must be a JSON object" }, 400);
  }

  if (body.declaration_accepted !== true) {
    return json({ detail: "declaration_accepted must be true" }, 400);
  }

  if (body.pin !== VALID_PIN) {
    return json({ detail: "Invalid PIN" }, 403);
  }

  const updated = submitServiceRequest(db, srId, subjectOrResponse);

  if (!updated || !updated.submitted_at) {
    return json({ detail: "Service request not found" }, 404);
  }

  return json({
    sr_id: updated.sr_id,
    sr_number: updated.sr_number,
    submitted_at: updated.submitted_at,
  });
}

function handleWithdrawServiceRequest(
  db: DB,
  claims: MockClaims,
  srId: string,
): Response {
  const subjectOrResponse = requireSubject(claims);

  if (isResponse(subjectOrResponse)) {
    return subjectOrResponse;
  }

  const sr = findServiceRequestById(db, srId, subjectOrResponse);

  if (!sr) {
    return json({ detail: "Service request not found" }, 404);
  }

  if (sr.status === "Withdrawn") {
    return json({ detail: "Service request already withdrawn" }, 409);
  }

  withdrawServiceRequest(db, srId, subjectOrResponse);

  return empty(204);
}

function handleGetAccountProfile(
  db: DB,
  claims: MockClaims,
): Response {
  const subjectOrResponse = requireSubject(claims);

  if (isResponse(subjectOrResponse)) {
    return subjectOrResponse;
  }

  const account = findAccountBySubject(db, subjectOrResponse);

  if (!account) {
    return json({ detail: "Account not found" }, 404);
  }

  return json(toProfileResponse(account));
}

async function handleUpdateAccountContact(
  req: Request,
  db: DB,
  claims: MockClaims,
): Promise<Response> {
  const subjectOrResponse = requireSubject(claims);

  if (isResponse(subjectOrResponse)) {
    return subjectOrResponse;
  }

  const body = await readJsonObject(req);

  if (!body) {
    return json({ detail: "Request body must be a JSON object" }, 400);
  }

  if (
    typeof body.email === "string" &&
    typeof body.email_confirm === "string" &&
    body.email !== body.email_confirm
  ) {
    return json({ detail: "email_confirm must match email" }, 422);
  }

  const email = typeof body.email === "string"
    ? body.email
    : body.email === null
    ? null
    : undefined;
  const phoneNumbers = Array.isArray(body.phones)
    ? objectArrayOrDefault(body.phones)
    : undefined;

  const account = updateAccountContact(
    db,
    subjectOrResponse,
    email,
    phoneNumbers,
  );

  if (!account) {
    return json({ detail: "Account not found" }, 404);
  }

  return json({ status: "ok" });
}

function handleGetCaseMembers(
  db: DB,
  claims: MockClaims,
): Response {
  const subjectOrResponse = requireSubject(claims);

  if (isResponse(subjectOrResponse)) {
    return subjectOrResponse;
  }

  const account = findAccountBySubject(db, subjectOrResponse);

  if (!account) {
    return json({ detail: "Account not found" }, 404);
  }

  return json({
    members: account.case_members,
  });
}

function handlePostLoginSync(claims: MockClaims): Response {
  const subjectOrResponse = requireSubject(claims);

  if (isResponse(subjectOrResponse)) {
    return subjectOrResponse;
  }

  return json({ status: "accepted" }, 202);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function handleRequest(req: Request, db: DB): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  const method = req.method.toUpperCase();

  if (method === "GET" && path === "/health") {
    return json({
      status: "ok",
      db: "ok",
      redis: "ok",
    });
  }

  if (method === "PUT" && path === "/data") {
    const claimsOrResponse = requireClaims(req);

    if (isResponse(claimsOrResponse)) {
      return claimsOrResponse;
    }

    return await handleDataImport(req, db);
  }

  const claimsOrResponse = path.startsWith("/service-requests") ||
      path.startsWith("/account")
    ? requireClaims(req)
    : null;

  if (claimsOrResponse && isResponse(claimsOrResponse)) {
    return claimsOrResponse;
  }

  const claims = claimsOrResponse as MockClaims | null;

  if (path === "/service-requests") {
    if (!claims) return notImplemented();

    if (method === "GET") {
      return handleListServiceRequests(url, db, claims);
    }

    if (method === "POST") {
      return await handleCreateServiceRequest(req, db, claims);
    }

    return json({ detail: "Method not allowed" }, 405);
  }

  if (path === "/service-requests/eligible-types") {
    if (!claims) return notImplemented();

    if (method === "GET") {
      return handleEligibleTypes();
    }

    return json({ detail: "Method not allowed" }, 405);
  }

  const serviceRequestMatch = path.match(/^\/service-requests\/([^/]+)$/);
  if (serviceRequestMatch) {
    if (!claims) return notImplemented();

    const srId = decodeURIComponent(serviceRequestMatch[1]);

    if (method === "GET") {
      return handleGetServiceRequest(db, claims, srId);
    }

    return json({ detail: "Method not allowed" }, 405);
  }

  const draftMatch = path.match(/^\/service-requests\/([^/]+)\/draft$/);
  if (draftMatch) {
    if (!claims) return notImplemented();

    const srId = decodeURIComponent(draftMatch[1]);

    if (method === "GET") {
      return handleGetServiceRequestDraft(db, claims, srId);
    }

    return json({ detail: "Method not allowed" }, 405);
  }

  const formMatch = path.match(/^\/service-requests\/([^/]+)\/form$/);
  if (formMatch) {
    if (!claims) return notImplemented();

    const srId = decodeURIComponent(formMatch[1]);

    if (method === "GET") {
      return handleGetServiceRequestForm(url, db, claims, srId);
    }

    if (method === "PUT") {
      return await handleUpdateServiceRequestForm(req, db, claims, srId);
    }

    return json({ detail: "Method not allowed" }, 405);
  }

  const submitMatch = path.match(/^\/service-requests\/([^/]+)\/submit$/);
  if (submitMatch) {
    if (!claims) return notImplemented();

    const srId = decodeURIComponent(submitMatch[1]);

    if (method === "POST") {
      return await handleSubmitServiceRequest(req, db, claims, srId);
    }

    return json({ detail: "Method not allowed" }, 405);
  }

  const withdrawMatch = path.match(/^\/service-requests\/([^/]+)\/withdraw$/);
  if (withdrawMatch) {
    if (!claims) return notImplemented();

    const srId = decodeURIComponent(withdrawMatch[1]);

    if (method === "POST") {
      return handleWithdrawServiceRequest(db, claims, srId);
    }

    return json({ detail: "Method not allowed" }, 405);
  }

  if (path === "/account/profile") {
    if (!claims) return notImplemented();

    if (method === "GET") {
      return handleGetAccountProfile(db, claims);
    }

    return json({ detail: "Method not allowed" }, 405);
  }

  if (path === "/account/contact") {
    if (!claims) return notImplemented();

    if (method === "PATCH") {
      return await handleUpdateAccountContact(req, db, claims);
    }

    return json({ detail: "Method not allowed" }, 405);
  }

  if (path === "/account/case-members") {
    if (!claims) return notImplemented();

    if (method === "GET") {
      return handleGetCaseMembers(db, claims);
    }

    return json({ detail: "Method not allowed" }, 405);
  }

  if (path === "/account/post-login-sync") {
    if (!claims) return notImplemented();

    if (method === "POST") {
      return handlePostLoginSync(claims);
    }

    return json({ detail: "Method not allowed" }, 405);
  }

  return notImplemented();
}

// ---------------------------------------------------------------------------
// Server entry point
// ---------------------------------------------------------------------------

const db = openDb();

console.log(`Database : ${DB_PATH}`);
console.log(`Listening: http://localhost:${PORT}`);
console.log(`
Implemented endpoints:
  GET  /health
  PUT  /data

  GET  /service-requests
  POST /service-requests
  GET  /service-requests/eligible-types
  GET  /service-requests/{sr_id}
  GET  /service-requests/{sr_id}/draft
  GET  /service-requests/{sr_id}/form
  PUT  /service-requests/{sr_id}/form
  POST /service-requests/{sr_id}/submit
  POST /service-requests/{sr_id}/withdraw

  GET   /account/profile
  PATCH /account/contact
  GET   /account/case-members
  POST  /account/post-login-sync

Everything else:
  501 Not Implemented

Mock PIN:
  ${VALID_PIN}

client identity:
  Imported records use explicit subject when provided.
  Otherwise subject is MD5(client_name), uppercase, no dashes.
  Imported records use explicit bceid_guid when provided.
  Otherwise bceid_guid is "BCEID:" + client_name.
  Client-scoped API calls match only by the token sub claim.
  The bceid_guid claim is not used for client request matching.
`);

Deno.serve({ port: PORT }, (req: Request) => handleRequest(req, db));