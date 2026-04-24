import path from "path";
import fs from "fs";
// @ts-ignore — node:sqlite experimental in Node 24
import { DatabaseSync } from "node:sqlite";

// ─── Paths ────────────────────────────────────────────────────────────────────
// Primary: SQLite. Failover: local FS (storage/failover/) if DB write fails.
// TWIN_MEMORY_DIR makes both paths relocatable (e.g. → Postgres-backed mount).

const STORAGE_DIR = process.env.TWIN_MEMORY_DIR
  ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../storage");

export const DB_PATH      = path.join(STORAGE_DIR, "twin.db");
export const FAILOVER_DIR = path.join(STORAGE_DIR, "failover");

fs.mkdirSync(FAILOVER_DIR, { recursive: true });

// ─── Connection ───────────────────────────────────────────────────────────────

export const db = new DatabaseSync(DB_PATH);

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_version (
    version    INTEGER PRIMARY KEY,
    applied_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS anchors (
    anchor_id   TEXT PRIMARY KEY,
    anchor_type TEXT NOT NULL,
    tag         TEXT NOT NULL,
    status      TEXT NOT NULL,
    state       TEXT NOT NULL,
    resume      TEXT NOT NULL,
    next        TEXT NOT NULL,
    delta       TEXT,
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS adls (
    adl_id      TEXT PRIMARY KEY,
    tag         TEXT,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL,
    status      TEXT NOT NULL,
    content     TEXT NOT NULL,
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orientation_maps (
    id          TEXT PRIMARY KEY,
    domain      TEXT NOT NULL,
    keywords    TEXT NOT NULL,
    content     TEXT NOT NULL,
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS test_plans (
    id          TEXT PRIMARY KEY,
    radar_id    TEXT,
    anchor_id   TEXT,
    title       TEXT,
    content     TEXT NOT NULL,
    updated_at  TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Migrations ───────────────────────────────────────────────────────────────

function currentVersion(): number {
  return (db.prepare(
    "SELECT MAX(version) as v FROM schema_version"
  ).get() as { v: number | null }).v ?? 0;
}

function migrate(version: number, sql: string): void {
  if (currentVersion() < version) {
    db.exec(sql);
    db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(version);
  }
}

// v1 — initial schema (tables created via IF NOT EXISTS above)
migrate(1, "SELECT 1");

// v2 — policies table
migrate(2, `
  CREATE TABLE IF NOT EXISTS policies (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    trigger_tags TEXT NOT NULL,
    strategy     TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'active',
    updated_at   TEXT DEFAULT (datetime('now'))
  )
`);

// v3+ — append here: migrate(3, "ALTER TABLE ...");

// ─── Failover write ───────────────────────────────────────────────────────────

export function writeWithFailover(
  operation: () => void,
  label: string,
  data: unknown
): { failover: boolean } {
  try {
    operation();
    return { failover: false };
  } catch {
    const file = path.join(FAILOVER_DIR, `${Date.now()}_${label}.json`);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    return { failover: true };
  }
}

// Wraps multiple writes in a single transaction — use when saving 2+ records together.
export function writeBatchWithFailover(
  operations: Array<() => void>,
  label: string,
  data: unknown
): { failover: boolean } {
  try {
    db.exec("BEGIN");
    try {
      operations.forEach((op) => op());
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    return { failover: false };
  } catch {
    const file = path.join(FAILOVER_DIR, `${Date.now()}_${label}.json`);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    return { failover: true };
  }
}
