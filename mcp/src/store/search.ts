import { db } from "./db.js";

// ─── Index write ──────────────────────────────────────────────────────────────
// Called by each store's save function after a successful write.
// Delete-then-insert is the standard FTS5 upsert pattern.

export function indexItem(
  item_id: string,
  item_type: string,
  title: string,
  abstract: string,
  tags: string
): void {
  db.prepare("DELETE FROM knowledge_fts WHERE item_id = ?").run(item_id);
  db.prepare(`
    INSERT INTO knowledge_fts (item_id, item_type, title, abstract, tags)
    VALUES (?, ?, ?, ?, ?)
  `).run(item_id, item_type, title, abstract, tags);
}

// ─── Cross-store search ───────────────────────────────────────────────────────
// Returns L0 results (no full content). Caller loads full item by item_id
// using the appropriate _load tool once relevance is confirmed.

type SearchRow = { item_id: string; item_type: string; title: string; abstract: string };

// item_id is UNINDEXED in knowledge_fts (see db.ts) — MATCH never sees it, so an
// id or ticket number that isn't echoed in the title/abstract/tags text
// (e.g. anchor_id "ticket-178698943" with tag "#widget-v2-dup-custom-feedback")
// is invisible to free-text search. Look up item_id directly as well.
export function contextSearch(query: string, limit = 5): string {
  const digitsOnly = query.replace(/[^0-9]/g, "");
  const issueNum = digitsOnly.length >= 7 ? digitsOnly : "";

  const idRows = db.prepare(`
    SELECT item_id, item_type, title, abstract
    FROM knowledge_fts
    WHERE item_id LIKE ? OR (? != '' AND item_id LIKE ?)
    ORDER BY length(item_id) ASC
    LIMIT ?
  `).all(`%${query}%`, issueNum, `%${issueNum}%`, limit) as SearchRow[];

  let ftsRows: SearchRow[] = [];
  try {
    ftsRows = db.prepare(`
      SELECT item_id, item_type, title, abstract
      FROM knowledge_fts
      WHERE knowledge_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(query, limit) as SearchRow[];
  } catch {
    // query may contain FTS5 syntax characters — id matches above still stand
  }

  const seen = new Set<string>();
  const rows: SearchRow[] = [];
  for (const r of [...idRows, ...ftsRows]) {
    if (seen.has(r.item_id)) continue;
    seen.add(r.item_id);
    rows.push(r);
    if (rows.length >= limit) break;
  }

  if (rows.length === 0) return `No results for: "${query}"`;

  return rows
    .map((r, i) => `[${i + 1}] ${r.item_type}:${r.item_id} — ${r.title}\n    ${r.abstract}`)
    .join("\n\n");
}

// ─── Reindex ──────────────────────────────────────────────────────────────────
// Full rebuild of knowledge_fts from source tables.
// Use if FTS diverges from source (e.g. after a partial write failure).

export function reindexAll(): string {
  db.exec("DELETE FROM knowledge_fts");

  const anchors = db.prepare(
    "SELECT anchor_id, tag, resume FROM anchors"
  ).all() as { anchor_id: string; tag: string; resume: string }[];
  for (const r of anchors) {
    indexItem(r.anchor_id, "anchor", r.tag, r.resume.slice(0, 200), r.tag);
  }

  const adls = db.prepare(
    "SELECT adl_id, tag, name, type, status, content FROM adls"
  ).all() as { adl_id: string; tag: string; name: string; type: string; status: string; content: string }[];
  for (const r of adls) {
    indexItem(r.adl_id, "adl", `${r.name} [${r.status}]`, r.content.slice(0, 200), `${r.tag} ${r.type}`);
  }

  const orientations = db.prepare(
    "SELECT id, domain, keywords, content FROM orientation_maps"
  ).all() as { id: string; domain: string; keywords: string; content: string }[];
  for (const r of orientations) {
    let kws = "";
    try { kws = (JSON.parse(r.keywords) as string[]).join(" "); } catch { kws = ""; }
    indexItem(r.id, "orientation", r.domain, r.content.slice(0, 200), kws);
  }

  const policies = db.prepare(
    "SELECT id, name, trigger_tags, strategy FROM policies"
  ).all() as { id: string; name: string; trigger_tags: string; strategy: string }[];
  for (const r of policies) {
    let tags = "";
    try { tags = (JSON.parse(r.trigger_tags) as string[]).join(" "); } catch { tags = ""; }
    indexItem(r.id, "policy", r.name, r.strategy.slice(0, 200), tags);
  }

  const plans = db.prepare(
    "SELECT id, issue_id, anchor_id, title, content FROM test_plans"
  ).all() as { id: string; issue_id: string; anchor_id: string; title: string; content: string }[];
  for (const r of plans) {
    const heading = r.title ?? r.id;
    const tags = [r.issue_id, r.anchor_id].filter(Boolean).join(" ");
    indexItem(r.id, "test_plan", heading, r.content.slice(0, 200), tags);
  }

  const total = anchors.length + adls.length + orientations.length + policies.length + plans.length;
  return `Reindexed ${total} items across all stores.`;
}
