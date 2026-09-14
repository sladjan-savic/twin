# 18. Anchor Store Retained Over Native Claude Code Memory — Data Sovereignty & Vendor Portability

- **Status:** decided
- **Originally:** ADL-24 (twin's internal SQLite ADL store)
- **Type:** architectural

---

## Context

The 2026-07-09 alignment assessment found twin's anchor store (SQLite anchors table, FTS5 L0 search, *_load hydration) implements the same core pattern as Claude Code's native auto-memory system: an index-first, lazy-hydrate, persist-across-sessions design. Native memory ships with zero custom infrastructure — no SQLite schema, no migrations, no FTS5 index, no MCP server to maintain — and was actively in use in the same session that ran the assessment (memories saved without touching twin's MCP server at all). This raised the question of whether the anchor store is redundant and should be retired in favor of native memory.

### Why Not Native Memory

- **data_sovereignty:** Native Claude Code memory lives inside whichever Claude Code instance is running — controlled by the client or employer providing that instance, not by the user. Anchors capture ticket-specific work detail (session state tied to specific client work) that the user considers their own, not infrastructure the employer should hold. This class of data must live somewhere the user controls.
- **vendor_portability:** The anchor store is agent-agnostic by construction (SQLite + a standalone MCP server, per ADL-11 and the twin README's stated design principle) — it survives a switch away from Claude Code to a different AI vendor or tool, forced or voluntary. Native memory is Claude-Code-specific and does not travel with a vendor switch.
- **user_statement:** Direct quote from the deciding conversation: "We're keeping the anchors. I dont want to pollute your memory with data that pertains to specific [ticket] work. Plus its a privacy thing: Client or my employer controls the claude instance. My own work is mine. Tommorow I can switch to another vendor if forced to by unforeseen circumstances."

## Decision

Keep the anchor store. Native memory does not replace it, for reasons orthogonal to functionality parity.

## Consequences

### Resulting Data Boundary

Ticket-specific session state (anchors) and architectural decisions about specific client work stay exclusively in twin's SQLite store. Native Claude Code memory is reserved for meta-level facts about how to collaborate with the user and about twin's own project/architecture — never for content that pertains to specific client/ticket work. This boundary is itself recorded in native memory (project_anchor_vs_native_memory.md) since it's a meta-fact about twin, not client-work content — consistent with the boundary it describes.

### Non-Goals

- Retiring or narrowing the policy store, orientation maps, or ADL store — those were not evaluated in this decision and remain open per ADL-23's ongoing evaluation method.
- Building any sync or migration path between native memory and the anchor store — the two are deliberately kept separate by data-sensitivity boundary, not merged.

### Risks

- **id:** R1
- **note:** The data boundary (client-work-in-anchors, meta-facts-in-native-memory) depends on the agent (this session) correctly classifying which bucket new information belongs to. Mitigation: project_anchor_vs_native_memory.md states the rule explicitly for future sessions to follow.
- **id:** R2
- **note:** If TWIN_MEMORY_DIR is ever pointed at a client/employer-controlled mount instead of the user's own machine, the sovereignty rationale for keeping the anchor store would be undermined. Mitigation: none currently enforced — worth a check if storage location ever changes.

### Next Steps

No implementation required — this ADL ratifies the status quo (anchor store stays as-is). Continue ADL-23's evaluation method on the remaining twin subsystems.

## Additional Detail

### Relationship To ADL-21 Agent Agnostic Gap

The 2026-07-09 internal assessment (not included in this repo) separately found that twin's README claims 'agent-agnostic by design' while ADL-13's subagent-spawn mechanic is admittedly Claude-Code-specific (per a personal capability-report narrative's own 'HONEST LIMITATIONS' section, also not included in this repo) — a real gap for that subsystem. This decision does not close that gap; it is scoped only to the anchor/memory store, which — unlike ADL-13's spawn mechanic — genuinely is agent-agnostic today (SQLite + MCP, no Claude-Code-specific dependency in the store itself).
