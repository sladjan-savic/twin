import { db, writeWithFailover } from "./db.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AnchorRecord = {
  anchor_id:   string;
  tag:         string;
  anchor_type: string;
  status:      string;
  state:       string;
  resume:      string;
  next:        string[];
  delta:       string;
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function loadAnchor(intent: string): string {
  const intentLower = intent.toLowerCase();
  const q = `%${intentLower}%`;
  const numOnly = intent.replace(/[^0-9]/g, "");
  const radarNum = numOnly.length >= 7 ? numOnly : "";

  const row = db.prepare(`
    SELECT * FROM anchors
    WHERE LOWER(anchor_id) LIKE ? OR LOWER(tag) LIKE ?
       OR (? != '' AND anchor_id LIKE ?)
    ORDER BY
      CASE
        WHEN LOWER(tag)       = ?    THEN 1
        WHEN LOWER(anchor_id) = ?    THEN 2
        WHEN LOWER(tag)       LIKE ? THEN 3
        WHEN LOWER(anchor_id) LIKE ? THEN 4
        ELSE 5
      END
    LIMIT 1
  `).get(q, q, radarNum, `%${radarNum}%`, intentLower, intentLower, q, q) as Record<string, unknown> | undefined;

  if (!row) {
    const all = db.prepare(
      "SELECT anchor_id, status FROM anchors ORDER BY updated_at DESC"
    ).all() as { anchor_id: string; status: string }[];
    return `No anchor found for: "${intent}". Available:\n` +
      all.map((a) => `  - ${a.anchor_id} [${a.status}]`).join("\n");
  }

  const { anchor_id, tag, anchor_type, status, state, resume, next } = row as any;
  return JSON.stringify(
    { identity: { tag, anchor_id, anchor_type, status }, state, resume, next: JSON.parse(next) },
    null, 2
  );
}

export function saveAnchor(anchor: AnchorRecord): string {
  const { anchor_id, tag, anchor_type, status, state, resume, next, delta } = anchor;
  const { failover } = writeWithFailover(
    () => db.prepare(`
      INSERT OR REPLACE INTO anchors
        (anchor_id, tag, anchor_type, status, state, resume, next, delta, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(anchor_id, tag, anchor_type, status, state, resume, JSON.stringify(next), delta),
    `anchor_${anchor_id}`,
    anchor
  );
  return failover ? `Saved anchor (failover): ${anchor_id}` : `Saved anchor: ${anchor_id}`;
}
