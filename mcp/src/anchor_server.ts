import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";

// ─── Config ──────────────────────────────────────────────────────────────────

const ANCHORS_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../anchors"
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadAnchorFiles(): { id: string; anchor: Record<string, unknown> }[] {
  return fs
    .readdirSync(ANCHORS_DIR)
    .filter((f: string) => f.endsWith(".json") && f !== "anchors.md")
    .map((f: string) => ({
      id: f.replace(".json", ""),
      anchor: JSON.parse(fs.readFileSync(path.join(ANCHORS_DIR, f), "utf8")),
    }));
}

function matchAnchor(intent: string, anchors: ReturnType<typeof loadAnchorFiles>) {
  const q = intent.toLowerCase();
  return anchors.find(({ id, anchor }) => {
    const identity = anchor.identity as Record<string, string>;
    return (
      id.toLowerCase().includes(q) ||
      identity?.tag?.toLowerCase().includes(q) ||
      identity?.anchor_id?.toLowerCase().includes(q) ||
      // match ticket numbers e.g. "172099103" or "ticket://172099103"
      q.replace(/[^0-9]/g, "") && id.includes(q.replace(/[^0-9]/g, ""))
    );
  });
}

function updateIndex(anchorId: string) {
  const indexPath = path.join(ANCHORS_DIR, "anchors.md");
  const content = fs.readFileSync(indexPath, "utf8");
  if (content.includes(anchorId)) return; // already indexed

  const entry = `     ${anchorId}.json`;
  // Insert before closing comment
  const updated = content.replace("-->", `${entry}\n-->`);
  fs.writeFileSync(indexPath, updated, "utf8");
}

// ─── Server ───────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "twin-anchor",
  version: "1.0.0",
});

// ─── Tool: anchor_load ───────────────────────────────────────────────────────

server.tool(
  "anchor_load",
  "Find and load an anchor by intent, tag, ticket ID, or anchor_id. Returns identity, state, resume, and next fields.",
  { intent: z.string().describe("Ticket ID, anchor tag, or natural language intent") },
  async ({ intent }) => {
    const anchors = loadAnchorFiles();
    const match = matchAnchor(intent, anchors);

    if (!match) {
      return {
        content: [{
          type: "text",
          text: `No anchor found for: "${intent}". Available anchors:\n` +
            anchors.map(({ id, anchor }) => {
              const identity = anchor.identity as Record<string, string>;
              return `  - ${id} [${identity?.status ?? "unknown"}]`;
            }).join("\n"),
        }],
      };
    }

    const { identity, state, resume, next } = match.anchor as {
      identity: unknown;
      state: string;
      resume: string;
      next: string[];
    };

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ identity, state, resume, next }, null, 2),
      }],
    };
  }
);

// ─── Tool: anchor_save ───────────────────────────────────────────────────────

const AnchorSchema = z.object({
  anchor_id:   z.string().describe("e.g. anchor-ticket-172099103"),
  tag:         z.string().describe("e.g. #{ticket-172099103-SHORT-NAME}"),
  anchor_type: z.string().describe("ticket | poc | technique | design"),
  status:      z.string().describe("in_progress | active | resolved | merged"),
  state:       z.string().describe("One paragraph — what is true right now"),
  resume:      z.string().describe("One sentence — where to pick up"),
  next:        z.array(z.string()).describe("Ordered list of next actions"),
  delta:       z.string().describe("Dated changelog entry for this save"),
});

server.tool(
  "anchor_save",
  "Create or update an anchor file. Writes flat-format JSON and updates the index.",
  { anchor: AnchorSchema },
  async ({ anchor }) => {
    const { anchor_id, tag, anchor_type, status, state, resume, next, delta } = anchor;

    const payload = {
      identity: { tag, anchor_id, anchor_type, status },
      state,
      resume,
      next,
      delta,
    };

    const filePath = path.join(ANCHORS_DIR, `${anchor_id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 4), "utf8");
    updateIndex(anchor_id);

    return {
      content: [{
        type: "text",
        text: `Saved: ${anchor_id}.json`,
      }],
    };
  }
);

// ─── Start ───────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
