import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from "path";
// @ts-ignore — node:sqlite experimental in Node 24
import { DatabaseSync } from "node:sqlite";

// ─── Config ──────────────────────────────────────────────────────────────────

const DB_PATH = process.env.TWIN_MEMORY_DIR
  ? path.join(process.env.TWIN_MEMORY_DIR, "twin.db")
  : path.resolve(
      path.dirname(new URL(import.meta.url).pathname),
      "../../storage/twin.db"
    );

// ─── Database ─────────────────────────────────────────────────────────────────

const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS anchors (
    anchor_id   TEXT PRIMARY KEY,
    anchor_type TEXT NOT NULL,
    tag         TEXT NOT NULL,
    status      TEXT NOT NULL,
    state       TEXT NOT NULL,
    resume      TEXT NOT NULL,
    next        TEXT NOT NULL,
    delta       TEXT,
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS adls (
    adl_id      TEXT PRIMARY KEY,
    tag         TEXT,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL,
    status      TEXT NOT NULL,
    content     TEXT NOT NULL,
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orientation_maps (
    id          TEXT PRIMARY KEY,
    domain      TEXT NOT NULL,
    keywords    TEXT NOT NULL,
    content     TEXT NOT NULL,
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS test_plans (
    id          TEXT PRIMARY KEY,
    radar_id    TEXT,
    anchor_id   TEXT,
    title       TEXT,
    content     TEXT NOT NULL,
    updated_at  TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Server ───────────────────────────────────────────────────────────────────

const server = new McpServer({ name: "twin-anchor", version: "2.0.0" });

// ─── anchor_load ─────────────────────────────────────────────────────────────

server.registerTool(
  "anchor_load",
  {
    description: "Find and load an anchor by intent, tag, ticket ID, or anchor_id.",
    inputSchema: { intent: z.string().describe("Ticket ID, anchor tag, or natural language intent") },
  },
  async ({ intent }) => {
    const intentLower = intent.toLowerCase();
    const q = `%${intentLower}%`;
    // Only use numeric extraction for proper ticket IDs (7+ digits); short strings like "1" from "V1" would match everything
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
      return {
        content: [{
          type: "text",
          text: `No anchor found for: "${intent}". Available:\n` +
            all.map((a) => `  - ${a.anchor_id} [${a.status}]`).join("\n"),
        }],
      };
    }

    const { anchor_id, tag, anchor_type, status, state, resume, next } = row as any;
    return {
      content: [{
        type: "text",
        text: JSON.stringify(
          { identity: { tag, anchor_id, anchor_type, status }, state, resume,
            next: JSON.parse(next) },
          null, 2
        ),
      }],
    };
  }
);

// ─── anchor_save ─────────────────────────────────────────────────────────────

server.registerTool(
  "anchor_save",
  {
    description: "Create or update an anchor in SQLite.",
    inputSchema: {
      anchor: z.object({
        anchor_id:   z.string(),
        tag:         z.string(),
        anchor_type: z.string(),
        status:      z.string(),
        state:       z.string(),
        resume:      z.string(),
        next:        z.array(z.string()),
        delta:       z.string(),
      }),
    },
  },
  async ({ anchor }) => {
    const { anchor_id, tag, anchor_type, status, state, resume, next, delta } = anchor;
    db.prepare(`
      INSERT OR REPLACE INTO anchors
        (anchor_id, tag, anchor_type, status, state, resume, next, delta, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(anchor_id, tag, anchor_type, status, state, resume, JSON.stringify(next), delta);
    return { content: [{ type: "text", text: `Saved anchor: ${anchor_id}` }] };
  }
);

// ─── orientation_load ────────────────────────────────────────────────────────

server.registerTool(
  "orientation_load",
  {
    description: "Load an orientation map by domain name or keyword. Returns the full markdown content.",
    inputSchema: { intent: z.string().describe("Domain name, subdomain, or keyword e.g. 'GroupBy', 'CSV upload'") },
  },
  async ({ intent }) => {
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
      return {
        content: [{
          type: "text",
          text: `No orientation map found for: "${intent}". Available:\n` +
            all.map((m) => `  - ${m.id} (${m.domain})`).join("\n"),
        }],
      };
    }

    return {
      content: [{ type: "text", text: `# ${row.domain}\n\n${row.content}` }],
    };
  }
);

// ─── orientation_save ────────────────────────────────────────────────────────

server.registerTool(
  "orientation_save",
  {
    description: "Create or update an orientation map. Content must be valid markdown following the orientation template.",
    inputSchema: {
      id:       z.string().describe("Slug e.g. 'dataset-groupby'"),
      domain:   z.string().describe("Human-readable domain name"),
      keywords: z.array(z.string()).describe("Match keywords for retrieval"),
      content:  z.string().describe("Full markdown content"),
    },
  },
  async ({ id, domain, keywords, content }) => {
    db.prepare(`
      INSERT OR REPLACE INTO orientation_maps (id, domain, keywords, content, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(id, domain, JSON.stringify(keywords), content);
    return { content: [{ type: "text", text: `Saved orientation map: ${id}` }] };
  }
);

// ─── adl_load ────────────────────────────────────────────────────────────────

server.registerTool(
  "adl_load",
  {
    description: "Load an architectural design log entry by ADL ID or tag.",
    inputSchema: { intent: z.string().describe("ADL ID (e.g. 'ADL-08') or tag") },
  },
  async ({ intent }) => {
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
      return {
        content: [{
          type: "text",
          text: `No ADL found for: "${intent}". Available:\n` +
            all.map((a) => `  - ${a.adl_id}: ${a.name} [${a.status}]`).join("\n"),
        }],
      };
    }

    return {
      content: [{ type: "text", text: row.content }],
    };
  }
);

// ─── test_plan_load ──────────────────────────────────────────────────────────

server.registerTool(
  "test_plan_load",
  {
    description: "Load a test plan by ticket ID, anchor ID, or title.",
    inputSchema: { intent: z.string().describe("Ticket ID, anchor ID, or title keyword") },
  },
  async ({ intent }) => {
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
      return {
        content: [{
          type: "text",
          text: `No test plan found for: "${intent}". Available:\n` +
            all.map((t) => `  - ${t.id} (${t.radar_id ?? "no ticket"})`).join("\n"),
        }],
      };
    }

    return {
      content: [{ type: "text", text: row.content }],
    };
  }
);

// ─── test_plan_save ──────────────────────────────────────────────────────────

server.registerTool(
  "test_plan_save",
  {
    description: "Save a test plan. Links to an anchor and optional ticket ID.",
    inputSchema: {
      id:        z.string().describe("Slug e.g. 'ticket-173690700-user-display-names'"),
      radar_id:  z.string().optional(),
      anchor_id: z.string().optional(),
      title:     z.string().optional(),
      content:   z.string().describe("Full markdown test plan"),
    },
  },
  async ({ id, radar_id, anchor_id, title, content }) => {
    db.prepare(`
      INSERT OR REPLACE INTO test_plans (id, radar_id, anchor_id, title, content, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(id, radar_id ?? null, anchor_id ?? null, title ?? null, content);
    return { content: [{ type: "text", text: `Saved test plan: ${id}` }] };
  }
);

// ─── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
