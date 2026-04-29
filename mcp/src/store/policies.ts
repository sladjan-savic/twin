import { db, writeWithFailover } from "./db.js";
import { indexItem } from "./search.js";

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

  try {
    indexItem(id, "policy", name, strategy.slice(0, 200), trigger_tags.join(" "));
  } catch { /* FTS is a cache — divergence recoverable via context_reindex */ }

  return failover ? `Saved policy (failover): ${id}` : `Saved policy: ${id}`;
}
