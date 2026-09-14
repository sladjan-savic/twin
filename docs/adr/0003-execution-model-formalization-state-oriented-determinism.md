# 3. Execution Model Formalization (State-Oriented Determinism)

- **Status:** achieved
- **Originally:** ADL-09 (twin's internal SQLite ADL store)
- **Tag:** #{ADL-SEQUENCE-EXTENDED-KERNEL-INTEGRATION-V2}
- **Type:** architectural + infra

---

## Context

### Scope

This invariant governs DB-record mutation only — the mcp/src/store/*.ts save* write paths (anchors, ADLs, policies, orientation maps, test plans), matching this ADL's own 'impact' list below. It does not extend to code or authored-artifact editing generally. ADL-21 (later, standing) prescribes surgical Edit as the default for code/authored artifacts and previously shared 'diff'/'surgical edit' vocabulary with this ADL without cross-referencing it — creating an apparent contradiction. Resolved 2026-07-17 by this scoping note; see cross_references.

## Decision

### Core Capabilities

- Shift from delta-based edits to atomic state replacement
- State-first thinking (DOM-style overwrite vs patching)
- Deterministic merge model (Map → Update → Reduce)
- Parent-controlled reconciliation

### Key Invariants

- No diff/surgical edits to persistent store records — only full state replacement
- Filesystem is source of truth
- Subagents cannot directly mutate persistent state

## Consequences

### Impact

- Reduced latency (7min → ~25s)
- Eliminated diff corruption class of errors
- Enabled reliable subagent coordination

### Note

This is a paradigm shift, not an optimization

### Cross-References

- **ADL-21:** Scopes this ADL's 'no surgical edits' invariant to DB-record mutation specifically (mcp/src/store/*.ts). Not in tension with ADL-21's surgical-Edit default for code and authored artifacts — the two govern different write surfaces.
