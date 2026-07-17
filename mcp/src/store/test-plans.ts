import { z } from "zod";
import { db, writeWithFailover } from "./db.js";
import { indexItem } from "./search.js";
import { formatZodError } from "./errors.js";

// ─── Schema ───────────────────────────────────────────────────────────────────

export const TestPlanSchema = z.object({
  id:        z.string().describe("Slug e.g. 'ticket-173690700-user-display-names'"),
  content:   z.string().describe("Full markdown test plan"),
  radar_id:  z.string().optional(),
  anchor_id: z.string().optional(),
  title:     z.string().optional(),
});

export type TestPlanRecord = z.infer<typeof TestPlanSchema>;

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

export function saveTestPlan(input: z.input<typeof TestPlanSchema>): string {
  let parsed: TestPlanRecord;
  try {
    parsed = TestPlanSchema.parse(input);
  } catch (e) {
    throw e instanceof z.ZodError ? new Error(formatZodError(e)) : e;
  }
  const { id, content, radar_id, anchor_id, title } = parsed;
  const data = { id, content, radar_id, anchor_id, title };
  const { failover } = writeWithFailover(
    () => db.prepare(`
      INSERT OR REPLACE INTO test_plans (id, radar_id, anchor_id, title, content, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(id, radar_id ?? null, anchor_id ?? null, title ?? null, content),
    `test_plan_${id}`,
    data
  );

  try {
    const heading = title ?? id;
    const tags = [radar_id, anchor_id].filter(Boolean).join(" ");
    indexItem(id, "test_plan", heading, content.slice(0, 200), tags);
  } catch { /* FTS is a cache — divergence recoverable via context_reindex */ }

  return failover ? `Saved test plan (failover): ${id}` : `Saved test plan: ${id}`;
}
