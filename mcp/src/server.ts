import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadAnchor, saveAnchor } from "./store/anchors.js";
import { loadOrientation, saveOrientation, loadAdl, saveAdl, loadTestPlan, saveTestPlan } from "./store/knowledge.js";

const server = new McpServer({ name: "twin-anchor", version: "2.0.0" });

// ─── Anchors ──────────────────────────────────────────────────────────────────

server.registerTool(
  "anchor_load",
  {
    description: "Find and load an anchor by intent, tag, ticket ID, or anchor_id.",
    inputSchema: { intent: z.string().describe("Ticket ID, anchor tag, or natural language intent") },
  },
  async ({ intent }) => ({
    content: [{ type: "text", text: loadAnchor(intent) }],
  })
);

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
  async ({ anchor }) => ({
    content: [{ type: "text", text: saveAnchor(anchor) }],
  })
);

// ─── Orientation maps ─────────────────────────────────────────────────────────

server.registerTool(
  "orientation_load",
  {
    description: "Load an orientation map by domain name or keyword. Returns the full markdown content.",
    inputSchema: { intent: z.string().describe("Domain name, subdomain, or keyword e.g. 'GroupBy', 'CSV upload'") },
  },
  async ({ intent }) => ({
    content: [{ type: "text", text: loadOrientation(intent) }],
  })
);

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
  async ({ id, domain, keywords, content }) => ({
    content: [{ type: "text", text: saveOrientation(id, domain, keywords, content) }],
  })
);

// ─── ADLs ─────────────────────────────────────────────────────────────────────

server.registerTool(
  "adl_load",
  {
    description: "Load an architectural design log entry by ADL ID or tag.",
    inputSchema: { intent: z.string().describe("ADL ID (e.g. 'ADL-08') or tag") },
  },
  async ({ intent }) => ({
    content: [{ type: "text", text: loadAdl(intent) }],
  })
);

server.registerTool(
  "adl_save",
  {
    description: "Create or update an ADL entry.",
    inputSchema: {
      adl_id:  z.string().describe("ADL ID e.g. 'ADL-11'"),
      tag:     z.string().optional().default(""),
      name:    z.string(),
      type:    z.string(),
      status:  z.string(),
      content: z.string().describe("Full JSON or markdown content of the ADL"),
    },
  },
  async ({ adl_id, tag, name, type, status, content }) => ({
    content: [{ type: "text", text: saveAdl(adl_id, tag, name, type, status, content) }],
  })
);

// ─── Test plans ───────────────────────────────────────────────────────────────

server.registerTool(
  "test_plan_load",
  {
    description: "Load a test plan by ticket ID, anchor ID, or title.",
    inputSchema: { intent: z.string().describe("Ticket ID, anchor ID, or title keyword") },
  },
  async ({ intent }) => ({
    content: [{ type: "text", text: loadTestPlan(intent) }],
  })
);

server.registerTool(
  "test_plan_save",
  {
    description: "Save a test plan. Links to an anchor and optional ticket ID.",
    inputSchema: {
      id:        z.string().describe("Slug e.g. 'ticket-173690700-user-display-names'"),
      content:   z.string().describe("Full markdown test plan"),
      radar_id:  z.string().optional(),
      anchor_id: z.string().optional(),
      title:     z.string().optional(),
    },
  },
  async ({ id, content, radar_id, anchor_id, title }) => ({
    content: [{ type: "text", text: saveTestPlan(id, content, radar_id, anchor_id, title) }],
  })
);

// ─── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
