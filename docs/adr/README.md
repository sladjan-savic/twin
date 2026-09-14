# Architecture Decision Records

Historical architecture decisions for twin, migrated from twin's internal SQLite ADL store (`storage/twin.db`, gitignored) so the design history is readable without running the MCP server. For the live, queryable source — including any ADLs recorded after this migration — use `mcp__twin-anchor__adl_load` or `mcp__twin-anchor__context_search` from a twin session.

Files are numbered `0000`–`0024`, sequentially, per the adr-tools/MADR
convention (`NNNN-kebab-case-title.md`). Twin's original internal id (e.g.
`ADL-07`) is preserved inside each file's header as `Originally:` for
traceability back to the live SQLite store, but is no longer part of the
filename.

Numbering here starts at `0000`/`0001`, not because twin's own ADL sequence
started at `ADL-01` — it didn't. Twin didn't track architecture decisions as
a numbered log before `ADL-07`; see [0000 — Prehistory](./0000-prehistory.md)
for what came before it.

| ADR # | Title | Status | Originally |
|---|---|---|---|
| 0000 | [Prehistory: Before ADL Numbering Started](./0000-prehistory.md) | historical record | — |
| 0001 | [Validated Cognitive Workflow Patterns](./0001-validated-cognitive-workflow-patterns.md) | achieved | ADL-07 |
| 0002 | [Context-Slice Retrieval via SQLite FTS5](./0002-context-slice-retrieval-via-sqlite-fts5.md) | proposed | ADL-08 |
| 0003 | [Execution Model Formalization (State-Oriented Determinism)](./0003-execution-model-formalization-state-oriented-determinism.md) | achieved | ADL-09 |
| 0004 | [Subagent Governance & Isolation Model](./0004-subagent-governance-isolation-model.md) | achieved | ADL-10 |
| 0005 | [Dual-Layer State Management (SQLite + Filesystem)](./0005-dual-layer-state-management-sqlite-filesystem.md) | decided | ADL-11 |
| 0006 | [Policy-Driven Execution Control](./0006-policy-driven-execution-control.md) | implemented | ADL-12 |
| 0007 | [Recursive Seam Decomposition Tree](./0007-recursive-seam-decomposition-tree.md) | implemented | ADL-13 |
| 0008 | [Vitest + in-memory SQLite for MCP server tests](./0008-vitest-in-memory-sqlite-for-mcp-server-tests.md) | accepted | ADL-14 |
| 0009 | [Orientation Map Discovery: Keyword-Ranked SQL Lookup](./0009-orientation-map-discovery-keyword-ranked-sql-lookup.md) | decided | ADL-15 |
| 0010 | [Storage RW Efficiency Principles](./0010-storage-rw-efficiency-principles.md) | standing | ADL-16 |
| 0011 | [Execution Log Store](./0011-execution-log-store.md) | deferred | ADL-17 |
| 0012 | [State-Driven Agent Execution Control](./0012-state-driven-agent-execution-control.md) | deferred | ADL-18 |
| 0013 | [Out-of-Band Stall Probe & Classified Recovery Dispatch](./0013-out-of-band-stall-probe-classified-recovery-dispatch.md) | deferred | ADL-19 |
| 0014 | [Runtime Strategy: Claude Code Interactive + Anthropic SDK Programmatic](./0014-runtime-strategy-claude-code-interactive-anthropic-sdk-programmatic.md) | proposed | ADL-20 |
| 0015 | [Edit Strategy: Regenerate Generated Artifacts, Surgical-Edit Authored Ones](./0015-edit-strategy-regenerate-generated-artifacts-surgical-edit-authored-ones.md) | standing | ADL-21 |
| 0016 | [Anchor Freshness Sweep as Weekly Report Pre-check](./0016-anchor-freshness-sweep-as-weekly-report-pre-check.md) | proposed | ADL-22 |
| 0017 | [Pivot: From Principle-First Learning Platform to Gradual Anthropic-System Alignment](./0017-pivot-from-principle-first-learning-platform-to-gradual-anthropic-system-alignment.md) | decided | ADL-23 |
| 0018 | [Anchor Store Retained Over Native Claude Code Memory — Data Sovereignty & Vendor Portability](./0018-anchor-store-retained-over-native-claude-code-memory-data-sovereignty-vendor-portability.md) | decided | ADL-24 |
| 0019 | [Structured Return Contract for Subagent Dispatches](./0019-structured-return-contract-for-subagent-dispatches.md) | proposed | ADL-25 |
| 0020 | [context:fork Investigation for twin-explore Isolation — Findings](./0020-context-fork-investigation-for-twin-explore-isolation-findings.md) | closed | ADL-26 |
| 0021 | [Review-Dispatch Isolation Cost — N=2 Measurement](./0021-review-dispatch-isolation-cost-n-2-measurement.md) | closed | ADL-27 |
| 0022 | [MCP Resources Catalog for Orientation Maps and ADLs — Added Alongside *_find/*_load](./0022-mcp-resources-catalog-for-orientation-maps-and-adls-added-alongside-find-load.md) | implemented | ADL-28 |
| 0023 | [Review→Design Loop-Back on Blocking Findings](./0023-review-design-loop-back-on-blocking-findings.md) | implemented | ADL-29 |
| 0024 | [Provenance Schema for Orientation Maps — Sources Field, Pilot on One Map](./0024-provenance-schema-for-orientation-maps-sources-field-pilot-on-one-map.md) | implemented | ADL-30 |
