import { z } from "zod";
import { db, writeWithFailover } from "./db.js";
import { indexItem } from "./search.js";
import { formatZodError } from "./errors.js";

// ─── Schema ───────────────────────────────────────────────────────────────────

export const PolicySchema = z.object({
  id:           z.string().describe("Kebab-case slug e.g. 'no-progress-escalation'"),
  name:         z.string(),
  trigger_tags: z.array(z.string()).describe("Keywords that trigger this policy"),
  strategy:     z.string().describe("Full strategy text the agent follows when this policy fires"),
  status:       z.string().describe("active | draft | retired"),
  priority:     z.number().optional().default(99).describe("Fire order when scores tie: 1=first, 99=last (default)"),
});

export type PolicyRecord = z.infer<typeof PolicySchema>;

export function findPolicies(tags: string[]): string {
  const all = db.prepare(
    "SELECT id, name, trigger_tags, status, priority FROM policies ORDER BY name"
  ).all() as { id: string; name: string; trigger_tags: string; status: string; priority: number }[];

  const lowerTags = tags.map((t) => t.toLowerCase());

  const scored = all
    .map((row) => {
      let kws: string[] = [];
      try { kws = (JSON.parse(row.trigger_tags) as string[]).map((k) => k.toLowerCase()); }
      catch { kws = []; }
      const score = kws.filter((k) => lowerTags.includes(k)).length;
      return { id: row.id, name: row.name, status: row.status, score, priority: row.priority ?? 99 };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.priority - b.priority);

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

export function savePolicy(input: z.input<typeof PolicySchema>): string {
  let parsed: PolicyRecord;
  try {
    parsed = PolicySchema.parse(input);
  } catch (e) {
    throw e instanceof z.ZodError ? new Error(formatZodError(e)) : e;
  }
  const { id, name, trigger_tags, strategy, status, priority } = parsed;
  const data = { id, name, trigger_tags, strategy, status, priority };
  const { failover } = writeWithFailover(
    () => db.prepare(`
      INSERT OR REPLACE INTO policies (id, name, trigger_tags, strategy, status, priority, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, name, JSON.stringify(trigger_tags), strategy, status, priority),
    `policy_${id}`,
    data
  );

  try {
    indexItem(id, "policy", name, strategy.slice(0, 200), trigger_tags.join(" "));
  } catch { /* FTS is a cache — divergence recoverable via context_reindex */ }

  return failover ? `Saved policy (failover): ${id}` : `Saved policy: ${id}`;
}
