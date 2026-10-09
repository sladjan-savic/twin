# twin

A portable cognitive workflow system for AI-augmented engineering. Structured reasoning state, a living knowledge base, and named recovery policies — designed to be agent-agnostic and transferable across implementations.

## Concept

Twin decouples the *workflow* from the *agent*. Reasoning state, architectural decisions, orientation maps, and recovery policies persist in a KB store that any agent can read and write. The agent is replaceable. The knowledge is not.

**The current implementation uses Claude Code as a reference orchestrator.** A dedicated orchestrator UI (model selection, context/toolset configuration, control plane) is the intended next layer — at which point Claude Code is no longer required.

**Core components:**

- **MCP server** — KB store: anchors, ADLs, orientation maps, policies, test plans. Passive. Agent-agnostic.
- **6-phase workflow** — structured skills for session init, ticket analysis, architecture exploration, design, review, test planning
- **Policy store** — named recovery strategies, queryable on demand
- **Context-slice search** — FTS5 index (`knowledge_fts`) over all store types; `context_search` returns ranked L0 abstracts so sessions load only what's relevant, not everything
- **SQLite** — L1 persistence with filesystem failover; designed for Postgres migration

## Prerequisites

- [Claude Code](https://claude.ai/code) (CLI or desktop) — reference implementation
- Node.js ≥ 22 (uses `node:sqlite` — experimental in Node 22, stable in Node 24)

## Setup

twin is a Claude Code plugin, published through the one-plugin `sladjan-tools` marketplace in this repo. Works on macOS, Linux, and Windows (no bash required).

```sh
claude plugin marketplace add <owner>/<repo>    # or a local clone: claude plugin marketplace add ./twin
claude plugin install twin@sladjan-tools
```

On the first session start, a SessionStart hook (`scripts/ensure-deps.mjs`) installs the MCP server's dependencies into the plugin's data directory (`~/.claude/plugins/data/<plugin-id>/`) and links them into `mcp/node_modules`. Later sessions skip the install unless `mcp/package.json` changed. The MCP server is started through `scripts/start-mcp.mjs`, which waits for (or performs) the same install, so it connects even on the first session. The SQLite database is created automatically on first use.

Start a Claude Code session in any directory and run `/twin:start`.

## Commands

Plugin commands are namespaced under `twin:`.

| Command | Description |
|---|---|
| `/twin:start` | Session init — load anchor, reconcile state, propose next step |
| `/twin:analyse` | Ticket analysis |
| `/twin:explore` | Architecture exploration |
| `/twin:design` | Design draft |
| `/twin:review` | Critical review (dispatches to the `twin:software-architect` agent) |
| `/twin:test-plan` | QA test plan generation |
| `/twin:anchor` | Save current session state |
| `/twin:orientate` | Assess and update orientation maps |
| `/twin:weekly-entry` | Team-doc weekly entry for one ticket |
| `/twin:weekly-report` | Aggregate the week's entries into a report |

Always start with `/twin:start`.

## Storage

```
${CLAUDE_PLUGIN_DATA}/      # ~/.claude/plugins/data/<plugin-id>/
  storage/
    twin.db                 # SQLite — primary store
    failover/               # JSON fallback on DB write failure
  node_modules/             # MCP server dependencies
```

**Tables:** `anchors`, `adls`, `orientation_maps`, `policies`, `test_plans`, `knowledge_fts` (FTS search index)

Your knowledge base is local to your machine. The plugin's `.mcp.json` sets `TWIN_MEMORY_DIR` to `${CLAUDE_PLUGIN_DATA}/storage`. Claude Code deletes the plugin data directory when you uninstall the plugin, so pass `--keep-data` to `claude plugin uninstall` (or back up `twin.db`) if you want to keep the knowledge base. To relocate it (e.g. a shared mount), change `TWIN_MEMORY_DIR` in `.mcp.json`. Without `TWIN_MEMORY_DIR` (e.g. `npm run dev` in `mcp/`), the server uses `storage/` at the repo root.

## Architecture

Architectural decisions are documented as ADLs (Architectural Design Logs) — stored in the system and queryable via `/twin:start` or directly:

```sh
sqlite3 <storage>/twin.db "SELECT adl_id, name, status FROM adls ORDER BY adl_id;"
```

Key decisions:

| ADL | Decision |
|---|---|
| ADL-08 | Context-slice retrieval via SQLite FTS5 — ranked L0 search over all stores |
| ADL-09 | Atomic state replacement over delta edits |
| ADL-10 | Subagents as pure functions — no direct writes |
| ADL-11 | SQLite L1 + filesystem failover L2 |
| ADL-12 | Policy-driven execution control |
| ADL-16 | Broad reads + batch writes as storage invariants |

## Development

The MCP server runs via `tsx` — no build step required during development.

```sh
cd mcp
npm run dev    # run directly with tsx
npm run build  # compile to dist/ (optional)
npm start      # run compiled output
```

## When the agent stalls

Policies are named behavioral instructions you invoke manually during a session. When you notice the agent is stuck, tell it to load the appropriate policy:

| Situation | Command |
|---|---|
| Task too complex to analyze as a unit — going in circles | `load policy complexity-seam-decomposition` |
| Agent is concluding on insufficient data or missing access | `load policy missing-info-escalation` |
| Repeated work, no progress, needs escalation | `load policy no-progress-escalation` |

Policies are stored in SQLite and queryable — adding a new one requires no code change.

## Roadmap

```
Current   KB store + 6-phase workflow via Claude Code (reference implementation)
Near-term Orientation sync — cron enriches KB against codebase
Next      Orchestrator UI — model/context/toolset selection, control plane, HITL surfaces
          Agent becomes swappable. Claude Code is no longer required.
Future    EDA — event-driven workflows, async HITL, UserTask resumption
```

## Design principles

- **Agent-agnostic by design.** The KB store is the product. The agent is the runtime. *Caveat: not yet true for every mechanism — ADL-13's seam-decomposition subagent spawn currently requires Claude Code's Agent tool specifically and is not independently usable with other orchestrators yet. The KB store itself (SQLite + MCP) has no such dependency.*
- **Human is always in the loop.** HITL is permanent — the system surfaces problems, humans decide.
- **MCP server is a store, not a controller.** KB accessor and design artifact registry only.
- **Policies are data, not enforcement.** Recovery strategies live in SQLite, invoked by the human on demand.
- **State is in the anchor.** Session resumption is anchor-load, not system replay.
