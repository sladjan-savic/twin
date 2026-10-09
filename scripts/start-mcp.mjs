// MCP launcher for twin-anchor: make sure dependencies are installed, then run
// the server (argv[2], passed from .mcp.json) under tsx with stdio inherited.
//
// Claude Code can start plugin MCP servers before the SessionStart hook has
// finished, and it caches a failed connection for a while. Ensuring deps here
// means the first session after install still connects.

import path from "node:path";
import { spawn } from "node:child_process";
import { ensureDeps } from "./ensure-deps.mjs";

const server = process.argv[2];
if (!server) {
  console.error("twin: usage: start-mcp.mjs <path to server.ts>");
  process.exit(1);
}

try {
  ensureDeps();
} catch (e) {
  console.error(`twin: ${e.message}`);
  process.exit(1);
}

const tsx = path.join(process.env.CLAUDE_PLUGIN_DATA, "node_modules", "tsx", "dist", "cli.mjs");
const child = spawn(process.execPath, [tsx, server], { stdio: "inherit" });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
