# 12. State-Driven Agent Execution Control

- **Status:** deferred
- **Originally:** ADL-18 (twin's internal SQLite ADL store)
- **Tag:** execution-control
- **Type:** architectural + control-plane

---

## Context

### Lineage

- **extends:** ADL-12 (Policy-Driven Execution Control)
- **enables:** ADL-14 (Toward Autonomous Cognitive System)
- **depends_on:** ADL-16 (Storage RW Efficiency Principles)

### Observation Model

- **approach:** passive_tool_call_interception
- **interception_point:** server.ts invoker
- **mechanism:** in-memory rolling window per session: tool name + args hash + timestamp
- **signals_derived:**
  - **repetition:** same tool + similar args called N times in window
  - **progress:** anchor_save / adl_save / write tools called
  - **stall:** only read tools firing, no write tools over window

## Decision

### State Machine

- **states:**
  - EXECUTE
  - DEGRADING
  - CONTAINED
  - RECOVERY
  - RESET
- **note:** Full spec preserved. Not implemented. Reactivate if use case changes.

### Placement Constraint

Control plane does not live in MCP server. Requires dedicated execution controller layer (separate process, SDK-based). That layer is not being built under current scope.

## Consequences

### Deferred Reason

- **date:** 2026-04-27
- **statement:** Design is sound. Use case does not require it. System operates in supervised collaboration mode — human is always present and performs spiral detection manually (btw probe pattern). Automated detection only adds value for unattended runs, which is not the current model.
- **reactivation_condition:** Use case shifts to longer unattended runs where human cannot manually intervene.

### Key Insight Preserved

Write operations are the observable progress unit. A window with zero writes is a candidate stall regardless of read volume. Read:write ratio discriminates spiral from inefficiency.
