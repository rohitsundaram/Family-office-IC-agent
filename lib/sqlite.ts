import Database from "better-sqlite3";
import path from "node:path";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import type { CaseRecord, AssetType } from "@/lib/models/case";
import { CaseSchema } from "@/lib/models/case";
import type { EvidenceItem } from "@/lib/models/evidence";
import type { AuditEvent } from "@/lib/models/audit";

let _db: Database.Database | null = null;

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "app.sqlite");

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  migrate(_db);
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      asset_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      title TEXT,
      inputs_json TEXT NOT NULL,
      last_analysis_json TEXT
    );

    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      url TEXT,
      excerpt TEXT NOT NULL,
      retrieved_at TEXT NOT NULL,
      FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      step_name TEXT NOT NULL,
      input_hash TEXT NOT NULL,
      output_summary TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS analyses (
      case_id TEXT PRIMARY KEY,
      decision_json TEXT NOT NULL,
      memo_md TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
    );
  `);
}

type DbCaseRow = {
  id: string;
  asset_type: string;
  created_at: string;
  updated_at: string;
  title: string | null;
  inputs_json: string;
  last_analysis_json: string | null;
};

function rowToCase(row: DbCaseRow, uploads: CaseRecord["uploadedDocs"]): CaseRecord {
  const last = row.last_analysis_json ? (JSON.parse(row.last_analysis_json) as unknown) : undefined;
  const record: CaseRecord = {
    id: row.id,
    assetType: row.asset_type as CaseRecord["assetType"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    title: row.title ?? undefined,
    inputs: (JSON.parse(row.inputs_json) as Record<string, unknown>) ?? {},
    uploadedDocs: uploads,
    lastAnalysis: last as CaseRecord["lastAnalysis"],
  };
  return CaseSchema.parse(record);
}

export async function listCases(): Promise<CaseRecord[]> {
  await ensureDataDir();
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM cases ORDER BY created_at DESC`).all() as DbCaseRow[];
  const uploadsByCase = listUploadsByCase(db, rows.map((r) => r.id));
  return rows.map((r) => rowToCase(r, uploadsByCase.get(r.id) ?? []));
}

export async function getCase(id: string): Promise<CaseRecord | null> {
  await ensureDataDir();
  const db = getDb();
  const row = db.prepare(`SELECT * FROM cases WHERE id = ?`).get(id) as DbCaseRow | undefined;
  if (!row) return null;
  const uploads = db
    .prepare(`SELECT filename, stored_path, uploaded_at FROM uploads WHERE case_id = ? ORDER BY uploaded_at DESC`)
    .all(id) as Array<{ filename: string; stored_path: string; uploaded_at: string }>;
  return rowToCase(
    row,
    uploads.map((u) => ({ filename: u.filename, storedPath: u.stored_path, uploadedAt: u.uploaded_at })),
  );
}

export async function createCase(params: {
  assetType: AssetType;
  title?: string;
  inputs?: Record<string, unknown>;
}): Promise<CaseRecord> {
  await ensureDataDir();
  const db = getDb();
  const now = new Date().toISOString();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO cases (id, asset_type, created_at, updated_at, title, inputs_json, last_analysis_json)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
  ).run(id, params.assetType, now, now, params.title ?? null, JSON.stringify(params.inputs ?? {}));
  const created = await getCase(id);
  if (!created) throw new Error("Failed to create case");
  return created;
}

export async function addUploadedDoc(params: {
  id: string;
  filename: string;
  storedPath: string;
}): Promise<CaseRecord> {
  await ensureDataDir();
  const db = getDb();
  const existing = await getCase(params.id);
  if (!existing) {
    const err = new Error("Case not found");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (err as any).statusCode = 404;
    throw err;
  }
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO uploads (id, case_id, filename, stored_path, uploaded_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(randomUUID(), params.id, params.filename, params.storedPath, now);
  db.prepare(`UPDATE cases SET updated_at = ? WHERE id = ?`).run(now, params.id);
  const updated = await getCase(params.id);
  if (!updated) throw new Error("Failed to load updated case");
  return updated;
}

export async function setLastAnalysis(params: {
  id: string;
  status: "ok" | "error";
  summary: string;
}): Promise<CaseRecord> {
  await ensureDataDir();
  const db = getDb();
  const existing = await getCase(params.id);
  if (!existing) {
    const err = new Error("Case not found");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (err as any).statusCode = 404;
    throw err;
  }
  const now = new Date().toISOString();
  const payload = {
    analyzedAt: now,
    status: params.status,
    summary: params.summary,
  };
  db.prepare(`UPDATE cases SET updated_at = ?, last_analysis_json = ? WHERE id = ?`).run(
    now,
    JSON.stringify(payload),
    params.id,
  );
  const updated = await getCase(params.id);
  if (!updated) throw new Error("Failed to load updated case");
  return updated;
}

function listUploadsByCase(db: Database.Database, caseIds: string[]) {
  const map = new Map<string, CaseRecord["uploadedDocs"]>();
  if (caseIds.length === 0) return map;
  const placeholders = caseIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT case_id, filename, stored_path, uploaded_at
       FROM uploads WHERE case_id IN (${placeholders})
       ORDER BY uploaded_at DESC`,
    )
    .all(...caseIds) as Array<{ case_id: string; filename: string; stored_path: string; uploaded_at: string }>;
  for (const r of rows) {
    const arr = map.get(r.case_id) ?? [];
    arr.push({ filename: r.filename, storedPath: r.stored_path, uploadedAt: r.uploaded_at });
    map.set(r.case_id, arr);
  }
  return map;
}

export async function addEvidence(params: Omit<EvidenceItem, "id" | "retrievedAt"> & { id?: string; retrievedAt?: string }) {
  await ensureDataDir();
  const db = getDb();
  const id = params.id ?? randomUUID();
  const retrievedAt = params.retrievedAt ?? new Date().toISOString();
  db.prepare(
    `INSERT INTO evidence (id, case_id, source_type, url, excerpt, retrieved_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, params.caseId, params.sourceType, params.url ?? null, params.excerpt, retrievedAt);
  return { id, retrievedAt };
}

export async function listEvidence(caseId: string): Promise<EvidenceItem[]> {
  await ensureDataDir();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, case_id, source_type, url, excerpt, retrieved_at
       FROM evidence WHERE case_id = ?
       ORDER BY retrieved_at DESC`,
    )
    .all(caseId) as Array<{
    id: string;
    case_id: string;
    source_type: EvidenceItem["sourceType"];
    url: string | null;
    excerpt: string;
    retrieved_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    caseId: r.case_id,
    sourceType: r.source_type,
    url: r.url ?? undefined,
    excerpt: r.excerpt,
    retrievedAt: r.retrieved_at,
  }));
}

export async function addAuditEvent(params: Omit<AuditEvent, "id" | "startedAt" | "finishedAt"> & { id?: string; startedAt?: string }) {
  await ensureDataDir();
  const db = getDb();
  const id = params.id ?? randomUUID();
  const startedAt = params.startedAt ?? new Date().toISOString();
  db.prepare(
    `INSERT INTO audit_events (id, case_id, step_name, input_hash, output_summary, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
  ).run(id, params.caseId, params.stepName, params.inputHash, params.outputSummary, startedAt);
  return { id, startedAt };
}

export async function finishAuditEvent(params: { id: string; outputSummary?: string; finishedAt?: string }) {
  await ensureDataDir();
  const db = getDb();
  const finishedAt = params.finishedAt ?? new Date().toISOString();
  if (params.outputSummary !== undefined) {
    db.prepare(`UPDATE audit_events SET output_summary = ?, finished_at = ? WHERE id = ?`).run(
      params.outputSummary,
      finishedAt,
      params.id,
    );
  } else {
    db.prepare(`UPDATE audit_events SET finished_at = ? WHERE id = ?`).run(finishedAt, params.id);
  }
  return { finishedAt };
}

export async function listAuditEvents(caseId: string): Promise<AuditEvent[]> {
  await ensureDataDir();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, case_id, step_name, input_hash, output_summary, started_at, finished_at
       FROM audit_events WHERE case_id = ?
       ORDER BY started_at ASC`,
    )
    .all(caseId) as Array<{
    id: string;
    case_id: string;
    step_name: string;
    input_hash: string;
    output_summary: string;
    started_at: string;
    finished_at: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    caseId: r.case_id,
    stepName: r.step_name,
    inputHash: r.input_hash,
    outputSummary: r.output_summary,
    startedAt: r.started_at,
    finishedAt: r.finished_at ?? undefined,
  }));
}

export async function upsertAnalysis(params: {
  caseId: string;
  decisionJson: string;
  memoMd: string;
  createdAt?: string;
}) {
  await ensureDataDir();
  const db = getDb();
  const createdAt = params.createdAt ?? new Date().toISOString();
  db.prepare(
    `INSERT INTO analyses (case_id, decision_json, memo_md, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(case_id) DO UPDATE SET decision_json = excluded.decision_json, memo_md = excluded.memo_md, created_at = excluded.created_at`,
  ).run(params.caseId, params.decisionJson, params.memoMd, createdAt);
  return { createdAt };
}

export async function getLatestAnalysis(caseId: string): Promise<null | { decisionJson: string; memoMd: string; createdAt: string }> {
  await ensureDataDir();
  const db = getDb();
  const row = db
    .prepare(`SELECT decision_json, memo_md, created_at FROM analyses WHERE case_id = ?`)
    .get(caseId) as { decision_json: string; memo_md: string; created_at: string } | undefined;
  if (!row) return null;
  return { decisionJson: row.decision_json, memoMd: row.memo_md, createdAt: row.created_at };
}
