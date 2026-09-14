# 13. Out-of-Band Stall Probe & Classified Recovery Dispatch

- **Status:** deferred
- **Originally:** ADL-19 (twin's internal SQLite ADL store)
- **Tag:** stall-probe
- **Type:** control-plane

---

## Context

### Two Stuck States

- **A_complexity_spiral:**
  - **description:** Task too complex to analyze as a unit. Agent goes in circles.
  - **policy:** complexity-seam-decomposition
- **B_missing_info_sidestepping:**
  - **description:** Agent lacks data or access. Concludes on insufficient basis.
  - **policy:** missing-info-escalation

## Decision

_See Additional Detail below for the substantive content of this record._

## Consequences

### Deferred Reason

- **date:** 2026-04-27
- **statement:** Design is sound and empirically validated. Human already runs this probe manually (btw pattern) — the mechanism works. Automation is not needed while human is always present. Deferred alongside ADL-18.
- **reactivation_condition:** ADL-18 execution controller exists and use case shifts to unattended runs.

### Probe Mechanism Preserved

- **trigger:** DEGRADING state — write_count == 0 over threshold window
- **execution:** out-of-band call from execution controller
- **probe_prompt:** Classify: (A) stuck on complexity, (B) missing info/access, (C) progressing. Answer A/B/C + one sentence.
- **response_routing:**
  - **A:** decompose
  - **B:** HITL halt
  - **C:** reset window

### Resolved Decisions Preserved

- **hitl:** Hard stop. Human cannot be circumvented. No timeout. Resumable via anchor.
- **recursive_decomposition:** Branch point — decompose further, defer to human, or escalate. Not a hard stop.
- **state_restoration:** System tells agent to load from anchor. Agent executes. System only needs anchor ID.
- **circuit_breaker:** Belongs in execution controller. Not in MCP server.
- **policy_branching:** Data-driven via policy_find(tags). Zero code change per new policy.
