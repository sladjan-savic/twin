import { z } from "zod";
import { db, writeWithFailover } from "./db.js";
import { indexItem } from "./search.js";
import { formatZodError } from "./errors.js";

// ─── Schema ───────────────────────────────────────────────────────────────────

export const AdlSchema = z.object({
  adl_id:  z.string().describe("ADL ID e.g. 'ADL-11'"),
  tag:     z.string().optional().default(""),
  name:    z.string(),
  type:    z.string(),
  status:  z.string(),
  content: z.string().describe("Full JSON or markdown content of the ADL"),
});

export type AdlRecord = z.infer<typeof AdlSchema>;

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

export function listAdls(): { adl_id: string; name: string; status: string }[] {
  return db.prepare(
    "SELECT adl_id, name, status FROM adls ORDER BY adl_id"
  ).all() as { adl_id: string; name: string; status: string }[];
}

export function getAdlById(adl_id: string): string | undefined {
  const row = db.prepare(
    "SELECT content FROM adls WHERE adl_id = ?"
  ).get(adl_id) as { content: string } | undefined;
  return row?.content;
}

export function saveAdl(input: z.input<typeof AdlSchema>): string {
  let parsed: AdlRecord;
  try {
    parsed = AdlSchema.parse(input);
  } catch (e) {
    throw e instanceof z.ZodError ? new Error(formatZodError(e)) : e;
  }
  const { adl_id, tag, name, type, status, content } = parsed;
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
