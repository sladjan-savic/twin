# 11. Execution Log Store

- **Status:** deferred
- **Originally:** ADL-17 (twin's internal SQLite ADL store)
- **Tag:** #{POC-COGNITIVE-WORKFLOW-V1}
- **Type:** infra

---

## Context

### Observation

When Policy B fires (no-progress escalation), full fidelity on the failure reason (verbatim tool output, error payload, context at point of failure) would be valuable for deep diagnosis and pattern detection. Anchor delta would reference the log entry; resume stays human-readable for triage.

## Decision

### Proposed Model

- **delta:** completed X, stopped at Y (log: log-id)
- **resume:** human-readable triage — self-sufficient without the log
- **log_entry:** full verbatim: tool call, output, error, context at failure point

## Consequences

### Why Deferred

DevOps/infra concern with no consumer yet. Structured logs become valuable when something reads them — pattern detection, dashboards, automated policy tuning. None of that exists. Build when a consumer needs it.

### Risks if Built Early

- Dead pointer risk — log pruning breaks anchor delta references
- Scope creep — log per policy trigger or all execution events?
- Premature optimisation — anchor + resume is sufficient for human-in-the-loop escalation now

### Trigger to Revisit

When a second control plane exists that could consume failure logs, or when recurring failure patterns need automated detection.
