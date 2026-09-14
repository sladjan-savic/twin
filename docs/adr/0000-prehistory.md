# 0000 — Prehistory: Before ADL Numbering Started

- **Status:** historical record (not a decision)
- **Period:** 2026-04-05 – 2026-04-23

## Why this file exists

The ADL sequence in `docs/adr/` starts at `ADL-07`. That isn't a gap where
`ADL-01`–`ADL-06` were lost — those numbers never existed. Before ADL-07,
twin wasn't tracking architecture decisions as a numbered log at all: it was
a plain 7-file prompt chain (`0_session_init.md` … `6_critical_review.md`)
with no ADL concept, and its decision/state record was a set of freeform
anchor documents (JSON, one per topic, with `STATUS` / `CONTEXT` /
`RULED_OUT` / `NEXT` fields) rather than numbered architectural records.

This file exists so that gap reads as *documented*, not *missing*.

## The chain

1. **Anchor system origin** (`anchor-anchor-system-bootstrap`, 2026-04-05,
   resolved) — the anchor concept itself was born out of an unrelated ticket
   investigation, but the session's actual output was infrastructure: an
   `anchors.md` index, the collapsible anchor format, the required fields
   (`STATUS`, `CONTEXT`, `RULED OUT`, `NEXT`, `SESSION STATE`, `DELTA`), and
   an update protocol (edit in place, `DELTA` block for history). This is
   the direct ancestor of what later became twin's SQLite anchor store
   ([ADR 0005](./0005-dual-layer-state-management-sqlite-filesystem.md), [ADR 0018](./0018-anchor-store-retained-over-native-claude-code-memory-data-sovereignty-vendor-portability.md)).

2. **Structured-prompting system analysis** (`anchor-structured-prompting-design`,
   2026-04-05, superseded) — a full review of the 7-file prompt chain,
   describing it as two coupled subsystems: a persistent memory layer
   (system context, domain context, anchors) and a stateless per-task
   pipeline (UNDERSTAND → EXPLORE → DESIGN → REVIEW). Identified the
   pipeline's core flaw — no formal handoff between phases, no write-back
   to memory — and flagged `RULED_OUT` as a non-obvious high-value field
   worth preserving in whatever came next. Superseded by the kernel design
   below the same day.

3. **Cognitive workflow kernel design** (`anchor-cognitive-kernel-001`,
   2026-04-05, validated-concept) — the architectural pivot: separate a
   deterministic orchestration kernel (owns canonical process state) from
   bounded, replaceable agent executors, with anchoring, policy, and event
   logging as distinct layers. Explicitly ruled out agent-owned
   orchestration, transcript-as-state, and premature distributed/Kafka
   design. This is the direct conceptual ancestor of twin's stage-pipeline
   + anchor-store + policy-layer architecture.

4. **POC implementation** (`anchor-poc-workflow-v1` + delta, 2026-04-05 →
   2026-04-23, in-progress at last update) — built out the kernel design
   above: phase-0 scope, a schema-completeness model (structural
   validation over LLM self-assessment), and evolution phases 0–5.

5. **Production ops test** (`anchor-k1-ops-001`, 2026-04-06, parent
   `anchor-cognitive-kernel-001`, active_production_test) — first real
   execution of the kernel design against live work.

`ADL-07 — Validated Cognitive Workflow Patterns` (status: achieved) is the
formal capstone of this chain — the point where "stable, repeatable
interaction patterns with structured anchoring and multi-context handling"
were judged validated enough to start recording future decisions as
numbered ADLs instead of freeform anchors. Everything from `ADL-07` onward
in this directory follows that later, numbered convention.

## Excluded from this record

Two other anchors from the same period were deliberately left out:
`anchor-poc-dev-env-v1` (an internal client-team dev-environment tooling POC,
unrelated to twin's own architecture) and an anchor tied to an unrelated bug
ticket (which happened to be the session where the anchor concept
originated). Same reasoning as the exclusions in the main ADR set:
not twin architecture, not safe for a public repo.

## Source

Reconstructed from personal backup copies of the original prompt-chain
files and anchor JSON records (predating twin's SQLite store), not from
`storage/twin.db` — these records predate the database entirely.
