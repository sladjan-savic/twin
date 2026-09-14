# 4. Subagent Governance & Isolation Model

- **Status:** achieved
- **Originally:** ADL-10 (twin's internal SQLite ADL store)
- **Type:** execution control

---

## Context

_Not explicitly separated in the source record; see Decision/Additional Detail below._

## Decision

### Core Capabilities

- Pure-function subagent model (input → output state)
- Isolation via merge queue
- Parent-mediated commit gate
- Schema validation before merge

### Key Invariants

- Subagents cannot write to disk
- All writes go through controlled reconciliation
- Invalid state is discarded (fail-fast)

## Consequences

### Note

Prevents uncontrolled multi-agent chaos

### Cross-References

- **ADL-25:** ADL-25 (Structured Return Contract for Subagent Dispatches) is motivated by this ADL's 'schema validation before merge, fail-fast' invariant but deliberately stops short of it for ad-hoc Agent-tool dispatches (e.g. the software-architect review dispatch) — convention-level JSON shape only, no runtime validation. That gap is documented in ADL-25, not silently left in tension with this ADL.
