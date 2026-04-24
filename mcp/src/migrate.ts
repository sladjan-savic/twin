import path from "path";
import fs from "fs";
// @ts-ignore
import { DatabaseSync } from "node:sqlite";

const MEMORY_DIR = process.env.TWIN_MEMORY_DIR ?? path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../storage"
);

const DB_PATH = path.join(MEMORY_DIR, "twin.db");

console.log(`Migrating into: ${DB_PATH}\n`);

const db = new DatabaseSync(DB_PATH);

db.exec(`
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

let counts = { anchors: 0, adls: 0, orientation: 0, test_plans: 0, skipped: 0 };

// ─── Anchors ──────────────────────────────────────────────────────────────────

const anchorsDir = path.join(MEMORY_DIR, "anchors");
const anchorStmt = db.prepare(`
  INSERT OR REPLACE INTO anchors
    (anchor_id, tag, anchor_type, status, state, resume, next, delta)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const file of fs.readdirSync(anchorsDir).filter((f: string) => f.endsWith(".json"))) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(anchorsDir, file), "utf8"));
    const items: any[] = Array.isArray(raw.manual_anchors) ? raw.manual_anchors : [raw];

    for (const a of items) {
      const id = a.identity?.anchor_id ?? a.anchor_id;
      if (!id) continue;
      const deltaStr = Array.isArray(a.delta)
        ? a.delta.map((d: any) => `${d.date}: ${d.note}`).join("\n")
        : (a.delta ?? "");
      anchorStmt.run(
        id,
        a.identity?.tag ?? a.tag ?? "",
        a.identity?.anchor_type ?? a.anchor_type ?? "ticket",
        a.identity?.status ?? a.status ?? "unknown",
        a.state ?? "", a.resume ?? "",
        JSON.stringify(Array.isArray(a.next) ? a.next : []),
        deltaStr
      );
      console.log(`  [anchor]  ${id}`);
      counts.anchors++;
    }
  } catch (e: any) { console.error(`  [skip]    ${file}: ${e.message}`); counts.skipped++; }
}

// ─── ADLs ─────────────────────────────────────────────────────────────────────

const adlDir = path.join(MEMORY_DIR, "adl");
const adlStmt = db.prepare(`
  INSERT OR REPLACE INTO adls (adl_id, tag, name, type, status, content)
  VALUES (?, ?, ?, ?, ?, ?)
`);

for (const file of fs.readdirSync(adlDir).filter((f: string) => f.endsWith(".json"))) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(adlDir, file), "utf8"));

    // Handle sequence file (contains adl_sequence array)
    if (Array.isArray(raw.adl_sequence)) {
      for (const entry of raw.adl_sequence) {
        adlStmt.run(
          entry.adl_id,
          raw.identity?.tag ?? null,
          entry.name,
          entry.type ?? "architectural",
          entry.status ?? "unknown",
          JSON.stringify(entry)
        );
        console.log(`  [adl]     ${entry.adl_id}: ${entry.name}`);
        counts.adls++;
      }
    } else {
      // Single ADL record
      const id = raw.identity?.anchor_id ?? raw.adl_id ?? path.basename(file, ".json");
      adlStmt.run(
        id,
        raw.identity?.tag ?? null,
        raw.purpose?.scope ?? id,
        raw.identity?.anchor_type ?? "design",
        raw.identity?.status ?? "unknown",
        JSON.stringify(raw)
      );
      console.log(`  [adl]     ${id}`);
      counts.adls++;
    }
  } catch (e: any) { console.error(`  [skip]    ${file}: ${e.message}`); counts.skipped++; }
}

// ─── Orientation maps ─────────────────────────────────────────────────────────

const orientDir = path.join(MEMORY_DIR, "orientation");
const orientStmt = db.prepare(`
  INSERT OR REPLACE INTO orientation_maps (id, domain, keywords, content)
  VALUES (?, ?, ?, ?)
`);

for (const file of fs.readdirSync(orientDir).filter((f: string) => f.endsWith(".md"))) {
  try {
    const content = fs.readFileSync(path.join(orientDir, file), "utf8");
    // Extract domain from filename: "Dataset GroupBy — Developer Orientation Map.md" → "Dataset GroupBy"
    const domain = file.replace(/ [—\-] Developer Orientation Map\.md$/, "")
                       .replace(/ [—\-] .*\.md$/, "")
                       .replace(/\.md$/, "");
    const id = domain.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const keywords = domain.split(/[\s\-—]+/).filter((w: string) => w.length > 2);

    orientStmt.run(id, domain, JSON.stringify(keywords), content);
    console.log(`  [orient]  ${id} (${domain})`);
    counts.orientation++;
  } catch (e: any) { console.error(`  [skip]    ${file}: ${e.message}`); counts.skipped++; }
}

// ─── Test plans ───────────────────────────────────────────────────────────────

const plansDir = path.join(MEMORY_DIR, "test_plans");
const planStmt = db.prepare(`
  INSERT OR REPLACE INTO test_plans (id, radar_id, anchor_id, title, content)
  VALUES (?, ?, ?, ?, ?)
`);

for (const file of fs.readdirSync(plansDir).filter(
  (f: string) => f.endsWith(".md") && !f.startsWith("_")
)) {
  try {
    const content = fs.readFileSync(path.join(plansDir, file), "utf8");
    const id = path.basename(file, ".md");
    // Extract radar_id from filename e.g. "ticket-173690700-user-display-names"
    const radarMatch = id.match(/ticket-(\d+)/);
    const radarId = radarMatch ? `ticket://${radarMatch[1]}` : null;
    // Title from first H1
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : id;

    planStmt.run(id, radarId, null, title, content);
    console.log(`  [plan]    ${id}`);
    counts.test_plans++;
  } catch (e: any) { console.error(`  [skip]    ${file}: ${e.message}`); counts.skipped++; }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`
Done:
  anchors:      ${counts.anchors}
  adls:         ${counts.adls}
  orientation:  ${counts.orientation}
  test_plans:   ${counts.test_plans}
  skipped:      ${counts.skipped}

Database: ${DB_PATH}
`);
