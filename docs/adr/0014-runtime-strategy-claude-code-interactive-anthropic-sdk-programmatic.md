# 14. Runtime Strategy: Claude Code Interactive + Anthropic SDK Programmatic

- **Status:** proposed
- **Originally:** ADL-20 (twin's internal SQLite ADL store)
- **Type:** runtime/harness

---

## Context

Twin was built on first principles — custom anchor MCP, custom slash commands, custom stage docs. The slash commands originally carried no frontmatter (description was the first body line, model was the session default, args were untyped, user-scope copies in ~/.claude/commands/ had drifted from the project source). 2026-06-18: adopted native Claude Code frontmatter (description / model / argument-hint) on all 10 commands, symlinked the user-scope copies to the project source, and pinned Opus 4.7 on the four reasoning-heavy stages while letting the rest inherit the session default (Sonnet 4.6). This ADL records that first step and articulates the natural follow-up: should twin migrate further — onto Anthropic SDK directly?

### Why Sdk Direct Is Attractive

- **programmatic_control:** Slash commands require a human typing. Weekly reports, multi-ticket sweeps, CI-triggered analyses, scheduled re-reviews — all of these want to invoke twin stages from code without a human in the loop. The current `claude -p` subprocess fallback (ctwin pattern, ref internal auth reference notes, not tracked in this repo) works but is fragile: no streaming, brittle JSON parsing, no native cache control.
- **cache_strategy_ownership:** Anthropic SDK exposes prompt caching as a first-class primitive (cache_control breakpoints). Twin's stage docs are stable and large — pinning them yields measurable cost reduction. Inside Claude Code the cache strategy is opaque to us. Concrete technique when reactivated (Claude Certified Architect guide Ch.1.5/11, added 2026-07-23 per the author's personal engineering backlog, not included in this repo): explicit cache_control breakpoints placed on stage docs specifically, rather than relying on Claude Code's opaque default caching behavior — matches the open_questions cache-strategy item below, now with a named technique rather than just 'measure hit rate.'
- **structured_output:** SDK supports tool-use-as-typed-output. Stage results (analysis findings, exploration map, design tradeoffs) become JSON, not free text. Downstream parsing stops being brittle. Concrete technique when reactivated (guide Domain 3.6/4.3, added 2026-07-23): for weekly-entry/weekly-report specifically, use `claude -p --output-format json --json-schema <schema>` rather than parsing free text — this is the CLI-level analog of the SDK's structured tool-use output and is usable even before a full SDK migration, via the existing subprocess fallback.
- **embeddability:** SDK calls compose into other systems — ticket-tracker webhooks, team-doc automations, observability dashboards, PR-merge hooks. Slash commands don't compose.
- **deployment_flexibility:** SDK can target Anthropic API direct (OIDC), an employer-internal mTLS gateway endpoint (service account, persistent), or Bedrock, without changing the harness. (See internal auth reference notes, not tracked in this repo — a sync OpenAI-compatible client + truststore is the pragmatic path for the internal gateway; the async client hangs.)
- **session_forking:** confirmed 2026-07-23 (ADL-26): fork_session=True + resume=<session_id> on ClaudeAgentOptions/Options is a real, documented SDK primitive that copies a session's full conversation history into a new, divergent session. This is programmatic-only — no interactive-session equivalent exists. It would let exploration-heavy stages (twin-explore, twin-analyse) branch off an isolated, full-context session rather than running inline in the main one, but only if step_2 activates.

### Why Keep Claude Code

- **tool_runtime_already_exists:** Claude Code provides MCP routing, Edit/Write/Bash, file watchers, the permission model. Reimplementing this on raw SDK = months of work for parity that already exists.
- **mcp_integration:** twin-anchor MCP is registered in ~/.claude.json — every tool call (anchor_save, orientation_find, adl_load) is one stdio hop away. Re-hosting MCP under a custom runtime means reimplementing the stdio protocol or shelling out anyway.
- **interactive_ux:** Slash commands, the prompt loop, /config, hooks, skills — these are the daily-use surface. Replacing them = rebuilding a CLI no one asked for.
- **cost_signal:** POC measured ~$5/9M tokens for a full day on Sonnet 4.6 inside Claude Code (ref internal cost-tracking notes, not tracked in this repo). A custom harness has no inherent cost advantage; the gain has to come from cache pinning, which is achievable inside Claude Code via prompt structure.

## Decision

### Hybrid Decomposition

- **stays_in_claude_code:**
  - twin-start, twin-analyse, twin-explore, twin-design, twin-review, twin-test-plan — cognitive stages that need the tool runtime plus human-in-the-loop.
  - twin-anchor, twin-orientate — state mutations driven by live session context.
  - Ad-hoc exploration, debugging, code generation.
- **moves_to_sdk_when_justified:**
  - twin-weekly-entry / twin-weekly-report — currently interactive; natural fit for scheduled runs or PR-merge hooks via SDK + the team-doc platform's API. Structured-output technique for this pair is already named (see why_sdk_direct_is_attractive.structured_output).
  - Cross-ticket sweeps (e.g. 'summarise risks across all open feature-review tickets').
  - CI hooks that consume twin policies (e.g. block merge if the diff contradicts a standing policy).
  - Bulk orientation map regeneration after large refactors.
- **shared_artifacts:** Both runtimes read/write the same SQLite store (twin.db) and stage docs. The SDK runtime imports the same prompts; only the invocation surface differs. This is the contract that keeps the two runtimes from drifting.

## Consequences

### Trajectory

- **step_1_done:** Native Claude Code idioms. Frontmatter on all 10 slash commands; symlinks from ~/.claude/commands/twin-*.md to /Users/sladjan/git/twin/.claude/commands/twin-*.md (single source of truth, installed by setup.sh); per-command model overrides — Opus 4.7 on twin-analyse / twin-explore / twin-design / twin-review; default elsewhere.
- **step_2_proposed:** Anthropic SDK as a SECOND runtime for non-interactive flows. NOT a wholesale replacement of Claude Code.
- **principle:** Match runtime to mode. Interactive ticket work stays in Claude Code (where MCP, Edit/Write/Bash, slash commands, skills, and the permission model already exist). Programmatic flows migrate to SDK direct.

### What Changed Today

- **frontmatter_added:**
  - description
  - model (4 commands)
  - argument-hint (2 commands)
- **frontmatter_skipped:** allowed-tools — twin already self-regulates capabilities through stage doc MODE declarations; OS-level gating duplicates that contract and is brittle.
- **command_bodies:** Unchanged. The 'Follow /Users/sladjan/git/twin/<N>_<stage>.md exactly' indirection is load-bearing — it lets stage doc edits propagate without touching the slash command.
- **drift_fix:** User-scope copies were stale (modified Apr 9, no frontmatter). Replaced with symlinks to the project source. setup.sh updated to install them idempotently.

### Non-Goals

- Replacing Claude Code as the interactive harness.
- Rewriting the cognitive workflow stages in SDK code — the stage docs remain the contract; SDK is just an alternative invocation surface.
- Multi-provider abstraction. Twin is Claude-specific by design; portability would dilute the prompt engineering.
- Batch API usage (confirmed 2026-07-23, guide Ch.7, per the author's personal engineering backlog item 13, not included in this repo): twin's weekly stages are single calls, not bulk/parallel workloads, so the Batch API is not a fit. SDK-direct-only scope (not SDK+Batch) was already the plan and needed no revision — this closes that question rather than leaving it implicitly open.

### Risks

- **id:** R1
- **note:** Two runtimes drift on stage doc semantics. Mitigation: stage docs are the single source of truth; both runtimes read them as-is and inject ticket context. No prompt logic in either runtime.
- **id:** R2
- **note:** Cost surprise from running SDK without Claude Code's caching defaults. Mitigation: explicit cache_control breakpoints from day one; track cost against POC baseline (internal cost-tracking notes, not tracked in this repo).
- **id:** R3
- **note:** Auth complexity leaks upward into runtime code. Mitigation: thin auth adapter; default to OIDC for local; internal gateway for service contexts.
- **id:** R4
- **note:** Premature migration. The case for SDK is real but theoretical until a concrete programmatic flow needs it. Mitigation: this ADL is proposed, not implemented — wait for forcing function (a real automation requirement).

### Cross-References

- **ADL-26:** ADL-26 (context:fork investigation for twin-explore isolation) confirmed fork_session is real but SDK-only, unreachable from twin-explore's current interactive-slash-command form. It's a concrete instance of this ADL's general SDK-only-capabilities framing, not itself a forcing function for migration — see ADL-26's relationship_to_adl20.

### Next Steps

No implementation scheduled. This ADL captures the trajectory and, as of 2026-07-23, the specific techniques to use once reactivated (structured CLI/SDK output for weekly stages, explicit cache_control breakpoints, confirmed non-fit of Batch API) — but none of these are built yet. A follow-up ADL will open when a concrete programmatic flow justifies starting the SDK runtime — most likely candidate is the weekly-entry/weekly-report pair, which already accept args and would benefit from PR-merge or scheduled invocation. Until then, `claude -p` subprocess remains the fallback.

## Open Questions

### Open Questions

- Auth: OIDC for local dev, internal-gateway mTLS for service contexts, Bedrock for prod? Or one adapter behind a flag? Internal auth reference notes (not tracked in this repo) suggest a sync OpenAI-compatible client + truststore is the pragmatic internal-gateway auth path.
- Co-location: SDK runtime sources inside this repo (sdk/ folder) or sibling project? Co-locating eases prompt reuse; separating cleans the dependency boundary.
- MCP access: SDK runtime imports its own subset of tools, or shells out to twin-anchor MCP via stdio? Latter avoids duplication; former avoids stdio overhead in batch.
- Cache strategy: layout still needs measuring against actual usage shape before committing — but the technique to use once measuring starts is now named (explicit cache_control breakpoints on stage docs, not Claude Code's opaque default), see why_sdk_direct_is_attractive.cache_strategy_ownership.
