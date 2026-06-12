import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadAnchor, saveAnchor, AnchorSchema } from "./store/anchors.js";
import { loadOrientation, findOrientations, saveOrientation, OrientationSchema } from "./store/orientations.js";
import { findPolicies, loadPolicy, savePolicy, PolicySchema } from "./store/policies.js";
import { loadAdl, saveAdl, AdlSchema } from "./store/adls.js";
import { loadTestPlan, saveTestPlan, TestPlanSchema } from "./store/test-plans.js";
import { contextSearch, reindexAll } from "./store/search.js";

const server = new McpServer({ name: "twin-anchor", version: "2.0.0" });

// ─── Search ───────────────────────────────────────────────────────────────────

server.registerTool(
  "context_search",
  {
    description: "Search across all knowledge stores (anchors, ADLs, orientations, policies, test plans). Returns ranked L0 results — title and abstract only, no full content. Use at session init and before targeted _load calls.",
    inputSchema: {
      query: z.string().describe("Natural language query or keywords"),
      limit: z.number().optional().default(5).describe("Max results (default 5)"),
    },
  },
  async ({ query, limit }) => ({
    content: [{ type: "text", text: contextSearch(query, limit ?? 5) }],
  })
);

server.registerTool(
  "context_reindex",
  {
    description: "Rebuild the FTS search index from source tables. Use if context_search returns stale or missing results.",
    inputSchema: {},
  },
  async () => ({
    content: [{ type: "text", text: reindexAll() }],
  })
);

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
      anchor: AnchorSchema,
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
  "orientation_find",
  {
    description: "Find orientation maps by tags. Returns ranked matches by keyword overlap score.",
    inputSchema: {
      tags: z.array(z.string()).describe("Intent keywords to match against orientation map keywords"),
    },
  },
  async ({ tags }) => ({
    content: [{ type: "text", text: findOrientations(tags) }],
  })
);

server.registerTool(
  "orientation_save",
  {
    description: "Create or update an orientation map. Content must be valid markdown following the orientation template.",
    inputSchema: OrientationSchema.shape,
  },
  async (record) => ({
    content: [{ type: "text", text: saveOrientation(record) }],
  })
);

// ─── Policies ─────────────────────────────────────────────────────────────────

server.registerTool(
  "policy_find",
  {
    description: "Find policies by trigger tags. Returns ranked matches by keyword overlap score.",
    inputSchema: {
      tags: z.array(z.string()).describe("Trigger keywords describing current situation e.g. ['stuck', 'no-progress', 'spiral']"),
    },
  },
  async ({ tags }) => ({
    content: [{ type: "text", text: findPolicies(tags) }],
  })
);

server.registerTool(
  "policy_load",
  {
    description: "Load a policy by id or name. Returns the full strategy.",
    inputSchema: {
      intent: z.string().describe("Policy id or name keyword"),
    },
  },
  async ({ intent }) => ({
    content: [{ type: "text", text: loadPolicy(intent) }],
  })
);

server.registerTool(
  "policy_save",
  {
    description: "Create or update a policy.",
    inputSchema: PolicySchema.shape,
  },
  async (record) => ({
    content: [{ type: "text", text: savePolicy(record) }],
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
    inputSchema: AdlSchema.shape,
  },
  async (record) => ({
    content: [{ type: "text", text: saveAdl(record) }],
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
    inputSchema: TestPlanSchema.shape,
  },
  async (record) => ({
    content: [{ type: "text", text: saveTestPlan(record) }],
  })
);

// ─── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
