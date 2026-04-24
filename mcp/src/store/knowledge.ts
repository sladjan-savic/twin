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

export function findOrientations(tags: string[]): string {
  const all = db.prepare(
    "SELECT id, domain, keywords FROM orientation_maps ORDER BY domain"
  ).all() as { id: string; domain: string; keywords: string }[];

  const lowerTags = tags.map((t) => t.toLowerCase());

  const scored = all
    .map((row) => {
      let kws: string[] = [];
      try { kws = (JSON.parse(row.keywords) as string[]).map((k) => k.toLowerCase()); }
      catch { kws = []; }
      const score = kws.filter((k) => lowerTags.includes(k)).length;
      return { id: row.id, domain: row.domain, keywords: kws, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return (
      `No orientation maps matched tags: [${tags.join(", ")}]. Available:\n` +
      all.map((m) => `  - ${m.id} (${m.domain})`).join("\n")
    );
  }

  return scored
    .map((r) => `[score:${r.score}] ${r.id} — ${r.domain} (keywords: ${r.keywords.join(", ")})`)
    .join("\n");
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

// ─── Policies ─────────────────────────────────────────────────────────────────

export function findPolicies(tags: string[]): string {
  const all = db.prepare(
    "SELECT id, name, trigger_tags, status FROM policies ORDER BY name"
  ).all() as { id: string; name: string; trigger_tags: string; status: string }[];

  const lowerTags = tags.map((t) => t.toLowerCase());

  const scored = all
    .map((row) => {
      let kws: string[] = [];
      try { kws = (JSON.parse(row.trigger_tags) as string[]).map((k) => k.toLowerCase()); }
      catch { kws = []; }
      const score = kws.filter((k) => lowerTags.includes(k)).length;
      return { id: row.id, name: row.name, status: row.status, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return (
      `No policies matched tags: [${tags.join(", ")}]. Available:\n` +
      all.map((p) => `  - ${p.id} (${p.name}) [${p.status}]`).join("\n")
    );
  }

  return scored
    .map((r) => `[score:${r.score}] ${r.id} — ${r.name} [${r.status}]`)
    .join("\n");
}

export function loadPolicy(intent: string): string {
  const q = `%${intent.toLowerCase()}%`;

  const row = db.prepare(`
    SELECT * FROM policies
    WHERE LOWER(id) LIKE ? OR LOWER(name) LIKE ? OR LOWER(trigger_tags) LIKE ?
    LIMIT 1
  `).get(q, q, q) as { id: string; name: string; strategy: string; status: string } | undefined;

  if (!row) {
    const all = db.prepare(
      "SELECT id, name, status FROM policies ORDER BY name"
    ).all() as { id: string; name: string; status: string }[];
    return `No policy found for: "${intent}". Available:\n` +
      all.map((p) => `  - ${p.id} (${p.name}) [${p.status}]`).join("\n");
  }

  return `# ${row.name} [${row.status}]\n\n${row.strategy}`;
}

export function savePolicy(
  id: string, name: string, trigger_tags: string[], strategy: string, status: string
): string {
  const data = { id, name, trigger_tags, strategy, status };
  const { failover } = writeWithFailover(
    () => db.prepare(`
      INSERT OR REPLACE INTO policies (id, name, trigger_tags, strategy, status, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(id, name, JSON.stringify(trigger_tags), strategy, status),
    `policy_${id}`,
    data
  );
  return failover ? `Saved policy (failover): ${id}` : `Saved policy: ${id}`;
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
