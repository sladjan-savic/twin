import { z } from "zod";
import { db, writeWithFailover } from "./db.js";
import { indexItem } from "./search.js";
import { formatZodError } from "./errors.js";

// ─── Schema ───────────────────────────────────────────────────────────────────

export const SourceSchema = z.object({
  claim: z.string().describe("Short paraphrase of the architectural claim being sourced"),
  file:  z.string().describe("Repo-relative file path the claim traces to"),
  line:  z.number().int().positive().optional().describe("Line number within the file, if applicable"),
});

export const OrientationSchema = z.object({
  id:       z.string().describe("Slug e.g. 'dataset-groupby'"),
  domain:   z.string().describe("Human-readable domain name"),
  keywords: z.array(z.string()).describe("Match keywords for retrieval"),
  content:  z.string().describe("Full markdown content"),
  sources:  z.array(SourceSchema).optional().default([])
    .describe("Provenance: which file[:line] each architectural claim in `content` traces to. Empty for maps predating ADL-30 or where a claim has no single traceable source."),
});

export type OrientationRecord = z.infer<typeof OrientationSchema>;
export type SourceRecord = z.infer<typeof SourceSchema>;

function renderSources(sources: SourceRecord[]): string {
  if (sources.length === 0) {
    return "\n\n_(No recorded sources — this map predates ADL-30's provenance field, or its claims have no single traceable source. Absence here doesn't mean unverified.)_";
  }
  const lines = sources.map((s) => `- ${s.claim} — \`${s.file}${s.line ? `:${s.line}` : ""}\``);
  return `\n\n## Sources\n\n${lines.join("\n")}`;
}

export function loadOrientation(intent: string): string {
  const q = `%${intent.toLowerCase()}%`;

  const row = db.prepare(`
    SELECT * FROM orientation_maps
    WHERE LOWER(domain) LIKE ? OR LOWER(keywords) LIKE ? OR LOWER(id) LIKE ?
    LIMIT 1
  `).get(q, q, q) as { id: string; domain: string; content: string; sources: string } | undefined;

  if (!row) {
    const all = db.prepare(
      "SELECT id, domain FROM orientation_maps ORDER BY domain"
    ).all() as { id: string; domain: string }[];
    return `No orientation map found for: "${intent}". Available:\n` +
      all.map((m) => `  - ${m.id} (${m.domain})`).join("\n");
  }

  let sources: SourceRecord[] = [];
  try { sources = JSON.parse(row.sources) as SourceRecord[]; } catch { sources = []; }

  return `# ${row.domain}\n\n${row.content}${renderSources(sources)}`;
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

export function listOrientations(): { id: string; domain: string }[] {
  return db.prepare(
    "SELECT id, domain FROM orientation_maps ORDER BY domain"
  ).all() as { id: string; domain: string }[];
}

export function getOrientationById(id: string): string | undefined {
  const row = db.prepare(
    "SELECT content, sources FROM orientation_maps WHERE id = ?"
  ).get(id) as { content: string; sources: string } | undefined;
  if (!row) return undefined;

  let sources: SourceRecord[] = [];
  try { sources = JSON.parse(row.sources) as SourceRecord[]; } catch { sources = []; }

  return `${row.content}${renderSources(sources)}`;
}

export function saveOrientation(input: z.input<typeof OrientationSchema>): string {
  let parsed: OrientationRecord;
  try {
    parsed = OrientationSchema.parse(input);
  } catch (e) {
    throw e instanceof z.ZodError ? new Error(formatZodError(e)) : e;
  }
  const { id, domain, keywords, content, sources } = parsed;
  const { failover } = writeWithFailover(
    () => db.prepare(`
      INSERT OR REPLACE INTO orientation_maps (id, domain, keywords, content, sources, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(id, domain, JSON.stringify(keywords), content, JSON.stringify(sources)),
    `orientation_${id}`,
    { id, domain, keywords, content, sources }
  );

  try {
    indexItem(id, "orientation", domain, content.slice(0, 200), keywords.join(" "));
  } catch { /* FTS is a cache — divergence recoverable via context_reindex */ }

  return failover ? `Saved orientation map (failover): ${id}` : `Saved orientation map: ${id}`;
}
