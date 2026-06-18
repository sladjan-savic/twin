#!/usr/bin/env bash
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "→ Installing MCP dependencies..."
cd "$REPO_DIR/mcp" && npm install

echo "→ Registering MCP server with Claude Code..."
node - <<EOF
const fs = require('fs');
const path = require('path');

const entry = {
  type: "stdio",
  command: "node",
  args: [
    "$REPO_DIR/mcp/node_modules/.bin/tsx",
    "$REPO_DIR/mcp/src/server.ts"
  ],
  env: {
    TWIN_MEMORY_DIR: "$REPO_DIR/storage"
  }
};

const configPath = path.join(process.env.HOME, '.claude.json');
let config = {};
try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}

config.mcpServers = config.mcpServers || {};
config.mcpServers['twin-anchor'] = entry;

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('✓ twin-anchor registered in ~/.claude.json');
EOF

echo "→ Linking twin slash commands into ~/.claude/commands/..."
mkdir -p "$HOME/.claude/commands"
for src in "$REPO_DIR"/.claude/commands/twin-*.md; do
  ln -sf "$src" "$HOME/.claude/commands/$(basename "$src")"
done
echo "✓ Slash commands linked (single source of truth: $REPO_DIR/.claude/commands/)"

echo ""
echo "✓ Setup complete. Start a new Claude Code session and run /twin-start."
