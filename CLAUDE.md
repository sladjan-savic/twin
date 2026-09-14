# twin

See `README.md` for concept, architecture, storage layout, and skill reference. This file covers what a session needs to work *on* twin itself, not what twin does for other work.

## Development

```sh
cd mcp
npm run dev     # run MCP server directly with tsx, no build step
npm test        # vitest — run once
npm run test:watch
npm run build   # compile to dist/, only needed to test the compiled path
```

After editing `mcp/src/**`, restart the MCP connection (new session, or whatever mechanism reloads MCP server subprocesses) before relying on the change through this session's own `mcp__twin-anchor__*` tools — a live connection keeps running the pre-edit build in memory. See ADL-30's `operational_finding_not_originally_scoped` for the failure mode this caused once (a save silently succeeded against the stale schema).

## File categories — see `.claude/rules/edit_strategy.md`

- **Generated** (weekly entries/reports, test plans, orientation maps, stage outputs): default to regenerating from spec, not surgical `Edit`. Surgical edits drift from what the spec would now produce.
- **Authored** (code, ADLs after initial save, `CLAUDE.md`, stage docs `0_*.md`–`8_*.md` themselves): surgical `Edit` after grep/symbol lookup is correct.

## Stage docs (`0_session_init.md` … `8_weekly_report.md`)

These are the methodology specs the `twin-*` skills follow — authored, not generated. Numbering is sequential by workflow stage, not by creation date. Changing one changes behavior for every future session that invokes the corresponding skill; treat it like changing a shared function signature.

## ADL log

Architectural decisions live in SQLite (`adls` table), not as files — query via `mcp__twin-anchor__adl_load` or `context_search`, or directly: `sqlite3 storage/twin.db "SELECT adl_id, name, status FROM adls ORDER BY adl_id;"`. Check for an existing ADL before re-deciding something that looks already-settled; ADL-23/24's evaluation method (native Anthropic/MCP mechanism vs. bespoke) is the standing test to apply before adding new infra to `mcp/src`.

## Client/employer domain content lives outside this repo

This file used to carry a specific client project's domain notes. That's a different project's knowledge, not twin's, so it now lives in a personal, gitignored file outside this repo, loaded via `CLAUDE.local.md` here and in that project's own repo — not here.
