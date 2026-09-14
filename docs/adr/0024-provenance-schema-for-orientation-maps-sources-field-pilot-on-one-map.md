# 24. Provenance Schema for Orientation Maps — Sources Field, Pilot on One Map

- **Status:** implemented
- **Originally:** ADL-30 (twin's internal SQLite ADL store)
- **Tag:** #ORIENTATION-PROVENANCE
- **Type:** architectural

---

## Context

From the author's personal engineering backlog (not included in this repo; cross-referenced against Claude Certified Architect guide Ch.12). Orientation maps were markdown blobs with no claim -> source-file:line tracking, unlike ADL entries which cite file:line paths inline as prose convention. Guide's 'attribution loss' pattern (Ch.12.1) motivated adding a structured provenance field rather than relying on the same inline-prose convention ADLs use.

## Decision

Added a `sources` field to OrientationSchema: an array of `{claim: string, file: string, line?: number}`. Structured (not inline-prose) so it's queryable/renderable independent of the markdown body, and optional/defaulted to `[]` so it doesn't force a breaking migration on existing content.

### Schema

- **field:** sources: z.array(z.object({claim, file, line?})).optional().default([])
- **storage:** New `sources` TEXT column on orientation_maps (migration v7, ALTER TABLE ... DEFAULT '[]'), JSON-encoded same pattern as the existing `keywords` column.
- **rendering:** loadOrientation and getOrientationById both append a rendered `## Sources` markdown section (one bullet per entry: `- {claim} — \`{file}:{line}\``) when sources is non-empty; omitted entirely when empty, so existing maps with no sources render identically to before this change.
- **why_new_getOrientationById_and_load_both_render:** getOrientationById (added for ADL-28's resources catalog, same session) and loadOrientation (the existing fuzzy-match tool) are two separate read paths into the same table -- both needed the same rendering logic so a client reading via either the resources catalog or the orientation_load tool sees identical provenance.

## Consequences

### Regeneration Scope

- **decision:** Schema + migration + one pilot map. Full regeneration of all ~26 existing maps explicitly deferred, per user decision 2026-07-23 -- the per-map cost of finding and verifying real file:line citations for every architectural claim in every existing map is a substantial, separate piece of work, not a mechanical batch operation.
- **pilot_map:** a single existing orientation map, chosen for having concrete existing prose claims to verify. Three claims from its existing 'Core Services & Files'/'Data Model' prose were independently re-verified against the live target-service source (not copied from the map's own possibly-stale text) before being added as sources: a domain-type enum extension, a set of related constants, and a controller entry point — each a separate file:line citation. All three verified correct via grep against the real source at pilot time.
- **remaining_25_maps:** Unchanged -- sources defaults to [] for every other existing map, rendering identically to their pre-ADL-30 form. No regression; provenance is additive, not required.

### Verification

- **build_and_unit_tests:** tsc clean; vitest suite grew from 62 to 68 passing tests (4 for the resources-catalog list/getById functions from ADL-28, plus 2 for sources default-empty and sources-populated rendering).
- **live_protocol_smoke_test:** Ran a fresh dist/server.js subprocess via @modelcontextprotocol/sdk Client/StdioClientTransport: saved a test map with sources via orientation_save, confirmed the rendered Sources section appears identically through both the orientation_load tool and the twin://orientation/{id} resource (ADL-28). Test data cleaned up after.

### Operational Finding (Not Originally Scoped)

- **issue:** This session's live twin-anchor MCP connection (the one behind every mcp__twin-anchor__* tool call used throughout this conversation) was started before this session's mcp/src edits and is running the pre-edit build in memory. Calling orientation_save with a `sources` field through that live connection silently succeeded but wrote nothing useful -- the old Zod schema doesn't reject unknown keys by default, and the old INSERT statement has no sources column, so the migration's DEFAULT '[]' was all that landed. Caught only because the rendered output (via the same stale connection's orientation_load) showed no Sources section despite the save appearing to succeed.
- **secondary_bug_found_while_fixing:** The first fix attempt used sqlite3 CLI's readfile() to inject the JSON directly, which returns a BLOB, not TEXT -- Node's node:sqlite driver then returned a Buffer/Uint8Array for that column instead of a string, which JSON.parse's try/catch silently swallowed (falling back to sources=[]), reproducing the identical symptom via a completely different root cause. Fixed by using a quoted TEXT literal in the UPDATE instead of readfile().
- **current_state:** The pilot map's sources are correctly persisted in storage/twin.db as TEXT (verified via typeof(sources)='text' and a fresh-subprocess read). But this session's live MCP connection and this session's ListMcpResourcesTool both still report zero resources / cannot use sources-aware orientation_save correctly, because the connection itself hasn't picked up today's build.
- **action_needed:** The twin-anchor MCP connection needs to be restarted/reconnected (new Claude Code session, or whatever mechanism reloads MCP server subprocesses) before ADL-28's resources catalog or ADL-30's sources field are usable through this session's own tools. Until then, any orientation_save call made through this session's live tools should be treated as NOT reliably persisting sources, and resources/list will keep reporting empty.

### Non-Goals

- Full regeneration of all 26 existing maps -- explicitly deferred, see regen_scope.
- Enforcing sources as required -- it is optional/defaulted, so existing maps and future maps authored without provenance remain valid.
- Line-range or multi-file citations per claim -- kept to single file + optional single line, matching the granularity ADL entries already use inline.

### Risks

- **id:** R1
- **note:** Sources can go stale the same way inline ADL file:line citations can (a later refactor moves the line). No staleness-detection mechanism added -- same accepted limitation as ADL entries' existing inline-citation convention, not a new gap introduced here.
- **id:** R2
- **note:** 25 of 26 existing maps still have no provenance. Anyone reading them should not assume absence of a Sources section means the map is unverified -- it may simply predate this ADL. Worth a one-line caveat if this becomes a source of confusion in practice.

### Cross-References

- **ADL-28:** Shares the getOrientationById/exact-lookup pattern this ADL's rendering logic reuses; both landed the same session.

### Next Steps

Restart/reconnect this session's twin-anchor MCP connection to pick up today's build before relying on resources/list or sources-aware orientation_save through this session's own tools. Full-catalog regeneration (25 remaining maps) is a separate, future-scoped task, not scheduled.
