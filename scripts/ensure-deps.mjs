// Install mcp/ dependencies into ${CLAUDE_PLUGIN_DATA} when they're missing or
// stale, then link <plugin root>/mcp/node_modules to them so server.ts's ESM
// imports resolve (ESM ignores NODE_PATH).
//
// Two callers, which can run at the same moment on a fresh install:
//   - the SessionStart hook (hooks/hooks.json) runs this file directly;
//   - scripts/start-mcp.mjs imports ensureDeps() before starting the server,
//     because Claude Code may start MCP servers before SessionStart finishes.
// A lock directory keeps them from running npm install concurrently.
//
// All output goes to stderr: SessionStart stdout is added to Claude's context,
// and the MCP server's stdout is its protocol channel.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const LOCK_STALE_MS = 10 * 60 * 1000;

const read = (p) => { try { return fs.readFileSync(p, "utf8"); } catch { return null; } };
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export function ensureDeps(root = process.env.CLAUDE_PLUGIN_ROOT, data = process.env.CLAUDE_PLUGIN_DATA) {
  if (!root || !data) throw new Error("CLAUDE_PLUGIN_ROOT / CLAUDE_PLUGIN_DATA not set");

  const srcPkg = path.join(root, "mcp", "package.json");
  const dataPkg = path.join(data, "package.json");
  const dataModules = path.join(data, "node_modules");
  const needsInstall = () => !fs.existsSync(dataModules) || read(srcPkg) !== read(dataPkg);

  if (needsInstall()) {
    fs.mkdirSync(data, { recursive: true });
    const lock = path.join(data, ".install-lock");
    acquire(lock);
    try {
      // The other caller may have finished the install while we waited.
      if (needsInstall()) install(root, data, srcPkg, dataPkg);
    } finally {
      fs.rmSync(lock, { recursive: true, force: true });
    }
  }

  link(path.join(root, "mcp", "node_modules"), dataModules);
}

function acquire(lock) {
  for (;;) {
    try { fs.mkdirSync(lock); return; } catch (e) { if (e.code !== "EEXIST") throw e; }
    try {
      if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) fs.rmSync(lock, { recursive: true, force: true });
    } catch {}
    sleep(500);
  }
}

function install(root, data, srcPkg, dataPkg) {
  fs.copyFileSync(srcPkg, dataPkg);
  const npmrc = path.join(root, "mcp", ".npmrc");
  if (fs.existsSync(npmrc)) fs.copyFileSync(npmrc, path.join(data, ".npmrc"));

  console.error(`twin: installing MCP dependencies into ${data} ...`);
  // shell: true so Windows resolves npm.cmd; the command string has no
  // user-controlled parts, and cwd carries the target directory.
  const r = spawnSync("npm install --no-audit --no-fund", {
    cwd: data,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  if (r.status !== 0) {
    // Drop the copied package.json so the next attempt retries.
    fs.rmSync(dataPkg, { force: true });
    throw new Error(`npm install failed (exit ${r.status ?? r.error?.message})\n${r.stdout ?? ""}${r.stderr ?? ""}`);
  }
  console.error("twin: MCP dependencies installed.");
}

function link(linkPath, target) {
  let stat = null;
  try { stat = fs.lstatSync(linkPath); } catch {}

  // A real directory: a dev checkout with its own `npm install`. Leave it alone.
  if (stat && !stat.isSymbolicLink()) return;
  if (stat && path.resolve(fs.readlinkSync(linkPath)) === path.resolve(target)) return;
  if (stat) fs.rmSync(linkPath, { force: true });
  try {
    // "junction" needs no admin rights on Windows; the type is ignored elsewhere.
    fs.symlinkSync(target, linkPath, "junction");
  } catch (e) {
    // The other caller created it between our check and now.
    if (e.code !== "EEXIST") throw e;
  }
}

// Run directly: the SessionStart hook.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    ensureDeps();
  } catch (e) {
    console.error(`twin: ${e.message}`);
    process.exit(1);
  }
}
