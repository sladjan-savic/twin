import { db, writeWithFailover, writeBatchWithFailover } from "./db.js";
import { indexItem } from "./search.js";

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
  parent_id?:  string;
  depth?:      number;
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

  const { anchor_id, tag, anchor_type, status, state, resume, next, parent_id, depth } = row as any;
  return JSON.stringify(
    {
      identity: { tag, anchor_id, anchor_type, status, parent_id: parent_id ?? null, depth: depth ?? 0 },
      state, resume, next: JSON.parse(next)
    },
    null, 2
  );
}

export function saveAnchor(anchor: AnchorRecord): string {
  const { anchor_id, tag, anchor_type, status, state, resume, next, delta, parent_id, depth } = anchor;

  const saveMain = () => db.prepare(`
    INSERT OR REPLACE INTO anchors
      (anchor_id, tag, anchor_type, status, state, resume, next, delta, parent_id, depth, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(anchor_id, tag, anchor_type, status, state, resume, JSON.stringify(next), delta, parent_id ?? null, depth ?? 0);

  const ops: Array<() => void> = [saveMain];

  // Completing a child seam: atomically pop self from parent's next[]; signal integrate if last sibling
  if (status === "completed" && parent_id) {
    ops.push(() => {
      const parentRow = db.prepare("SELECT next FROM anchors WHERE anchor_id = ?")
        .get(parent_id) as { next: string } | undefined;
      if (parentRow) {
        let parentNext: string[] = [];
        try { parentNext = JSON.parse(parentRow.next); } catch { parentNext = []; }
        parentNext = parentNext.filter((id) => id !== anchor_id);
        if (parentNext.length === 0) parentNext = ["integrate"];
        db.prepare("UPDATE anchors SET next = ?, updated_at = datetime('now') WHERE anchor_id = ?")
          .run(JSON.stringify(parentNext), parent_id);
      }
    });
  }

  // Closing/abandoning: recursively delete all non-completed descendants
  if (status === "closed" || status === "abandoned") {
    ops.push(() => {
      db.prepare(`
        WITH RECURSIVE orphan_tree(id) AS (
          SELECT anchor_id FROM anchors WHERE parent_id = ? AND status != 'completed'
          UNION ALL
          SELECT a.anchor_id FROM anchors a INNER JOIN orphan_tree o ON a.parent_id = o.id
        )
        DELETE FROM anchors WHERE anchor_id IN (SELECT id FROM orphan_tree)
      `).run(anchor_id);
    });
  }

  const { failover } = ops.length > 1
    ? writeBatchWithFailover(ops, `anchor_${anchor_id}`, anchor)
    : writeWithFailover(saveMain, `anchor_${anchor_id}`, anchor);

  try {
    indexItem(anchor_id, "anchor", tag, resume.slice(0, 200), tag);
  } catch { /* FTS is a cache — divergence recoverable via context_reindex */ }

  return failover ? `Saved anchor (failover): ${anchor_id}` : `Saved anchor: ${anchor_id}`;
}