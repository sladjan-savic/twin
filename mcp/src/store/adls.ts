import { db, writeWithFailover } from "./db.js";
import { indexItem } from "./search.js";

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

  try {
    indexItem(adl_id, "adl", `${name} [${status}]`, content.slice(0, 200), `${tag} ${type}`);
  } catch { /* FTS is a cache — divergence recoverable via context_reindex */ }

  return failover ? `Saved ADL (failover): ${adl_id}` : `Saved ADL: ${adl_id}`;
}
