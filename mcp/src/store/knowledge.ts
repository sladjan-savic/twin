import { db, writeWithFailover } from "./db.js";

// ─── Orientation maps ─────────────────────────────────────────────────────────

export function loadOrientation(intent: string): string {
  const q = `%${intent.toLowerCase()}%`;

  const row = db.prepare(`
    SELECT * FROM orientation_maps
    WHERE LOWER(domain) LIKE ? OR LOWER(keywords) LIKE ? OR LOWER(id) LIKE ?
    LIMIT 1
  `).get(q, q, q) as { id: string; domain: string; content: string } | undefined;

  if (!row) {
    const all = db.prepare(
      "SELECT id, domain FROM orientation_maps ORDER BY domain"
    ).all() as { id: string; domain: string }[];
    return `No orientation map found for: "${intent}". Available:\n` +
      all.map((m) => `  - ${m.id} (${m.domain})`).join("\n");
  }

  return `# ${row.domain}\n\n${row.content}`;
}

export function saveOrientation(
  id: string, domain: string, keywords: string[], content: string
): string {
  const { failover } = writeWithFailover(
    () => db.prepare(`
      INSERT OR REPLACE INTO orientation_maps (id, domain, keywords, content, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(id, domain, JSON.stringify(keywords), content),
    `orientation_${id}`,
    { id, domain, keywords, content }
  );
  return failover ? `Saved orientation map (failover): ${id}` : `Saved orientation map: ${id}`;
}

// ─── ADLs ─────────────────────────────────────────────────────────────────────

export function loadAdl(intent: string): string {
  const q = `%${intent.toLowerCase()}%`;

  const row = db.prepare(`
    SELECT * FROM adls
    WHERE LOWER(adl_id) LIKE ? OR LOWER(tag) LIKE ? OR LOWER(name) LIKE ?
    LIMIT 1
  `).get(q, q, q) as { adl_id: string; name: string; content: string } | undefined;

  if (!row) {
    const all = db.prepare(
      "SELECT adl_id, name, status FROM adls ORDER BY adl_id"
    ).all() as { adl_id: string; name: string; status: string }[];
    return `No ADL found for: "${intent}". Available:\n` +
      all.map((a) => `  - ${a.adl_id}: ${a.name} [${a.status}]`).join("\n");
  }

  return row.content;
}

export function saveAdl(
  adl_id: string, tag: string, name: string, type: string, status: string, content: string
): string {
  const data = { adl_id, tag, name, type, status, content };
  const { failover } = writeWithFailover(
    () => db.prepare(`
      INSERT OR REPLACE INTO adls (adl_id, tag, name, type, status, content, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(adl_id, tag, name, type, status, content),
    `adl_${adl_id}`,
    data
  );
  return failover ? `Saved ADL (failover): ${adl_id}` : `Saved ADL: ${adl_id}`;
}

// ─── Test plans ───────────────────────────────────────────────────────────────

export function loadTestPlan(intent: string): string {
  const intentLower = intent.toLowerCase();
  const q = `%${intentLower}%`;
  const numOnly = intent.replace(/[^0-9]/g, "");
  const radarNum = numOnly.length >= 7 ? numOnly : "";

  const row = db.prepare(`
    SELECT * FROM test_plans
    WHERE LOWER(id) LIKE ? OR LOWER(title) LIKE ?
       OR (? != '' AND radar_id LIKE ?)
    ORDER BY
      CASE
        WHEN LOWER(id)    = ?    THEN 1
        WHEN LOWER(title) = ?    THEN 2
        WHEN LOWER(id)    LIKE ? THEN 3
        ELSE 4
      END
    LIMIT 1
  `).get(q, q, radarNum, `%${radarNum}%`, intentLower, intentLower, q) as
    { id: string; title: string; content: string } | undefined;

  if (!row) {
    const all = db.prepare(
      "SELECT id, radar_id, title FROM test_plans ORDER BY updated_at DESC"
    ).all() as { id: string; radar_id: string; title: string }[];
    return `No test plan found for: "${intent}". Available:\n` +
      all.map((t) => `  - ${t.id} (${t.radar_id ?? "no ticket"})`).join("\n");
  }

  return row.content;
}

export function saveTestPlan(
  id: string, content: string,
  radar_id?: string, anchor_id?: string, title?: string
): string {
  const data = { id, content, radar_id, anchor_id, title };
  const { failover } = writeWithFailover(
    () => db.prepare(`
      INSERT OR REPLACE INTO test_plans (id, radar_id, anchor_id, title, content, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(id, radar_id ?? null, anchor_id ?? null, title ?? null, content),
    `test_plan_${id}`,
    data
  );
  return failover ? `Saved test plan (failover): ${id}` : `Saved test plan: ${id}`;
}
