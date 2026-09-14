# 6. Policy-Driven Execution Control

- **Status:** implemented
- **Originally:** ADL-12 (twin's internal SQLite ADL store)
- **Tag:** #{POC-COGNITIVE-WORKFLOW-V1}
- **Type:** control-plane

---

## Context

_Not explicitly separated in the source record; see Decision/Additional Detail below._

## Decision

### Policies

- **A_proactive:**
  - **name:** Complexity: Seam Decomposition
  - **id:** complexity-seam-decomposition
  - **trigger:** Same operation attempted TWIN_DECOMPOSE_THRESHOLD times with no new information gained
  - **trigger_tags:**
    - complex
    - too-large
    - seam
    - decompose
    - scope-too-wide
    - loop
    - going-in-circles
  - **priority:** 1
  - **action:** Depth guard → Stop → blackbox → find seams → name them → confirm if >3 → create child anchors (parent_id + depth+1) → handle each independently → integrate
  - **status:** active
- **B_reactive:**
  - **name:** No-Progress Escalation
  - **id:** no-progress-escalation
  - **trigger:** Same operation attempted TWIN_ESCALATE_THRESHOLD times with no new information gained
  - **trigger_tags:**
    - stuck
    - blocked
    - no-progress
    - spiral
    - no-new-information
    - repeated-work
  - **priority:** 2
  - **action:** Update anchor (delta + specific resume) → surface to human → stop
  - **status:** active

### Priority Model

- **field:** priority INTEGER NOT NULL DEFAULT 99 (v4 migration)
- **sort:** score DESC, priority ASC — lower priority number fires first on tie
- **rationale:** A fires before B when both triggered: decompose before escalating to human

### Threshold Config

- **model:** three-tier precedence
- **per_policy:**
  - **A:** TWIN_DECOMPOSE_THRESHOLD
  - **B:** TWIN_ESCALATE_THRESHOLD
- **shared_default:** TWIN_NO_PROGRESS_THRESHOLD
- **hardcoded_fallback:** 2
- **depth_limit:** TWIN_DECOMPOSE_MAX_DEPTH (default: 3)
- **rationale:** 2 retries is pure cost. Depth 3 matches human comprehension limit — at depth >= 3, escalation beats further decomposition.

### Anchor Contract

When Policy B fires, the agent MUST write a specific resume before stopping — not 'I am stuck' but the exact operation, tool, and failure. Escalation quality depends entirely on resume specificity.

### Implementation

- **store:** policies table in SQLite (v4 migration): id, name, trigger_tags, strategy, status, priority
- **tools:** policy_find(tags[]), policy_load(intent), policy_save — all live in server.ts + store/policies.ts
- **seeded:**
  - complexity-seam-decomposition (Policy A, priority=1)
  - no-progress-escalation (Policy B, priority=2)

## Consequences

### Non-Goals

- **id:** NG1
- **note:** Never gate escalation on self-rated model confidence (e.g. an agent-produced 1-10 confidence score). Added 2026-07-17, sourced from the Claude Certified Architect study guide (Ch.9.1): a model can be confidently wrong; self-rated confidence is not a reliable proxy for actual task complexity or correctness. Trigger heuristics A and B stay behavioral (repeated work, no new information) and observable (tool call outcomes, anchor state), not introspective. This was already true by omission — this entry makes it an explicit constraint so a future change doesn't add confidence-gating by default.

### Risks

- **id:** R1
- **note:** RESOLVED. Trigger heuristic: repeated work without new information gained. Threshold configurable via TWIN_DECOMPOSE_THRESHOLD / TWIN_NO_PROGRESS_THRESHOLD (default: 2).
- **id:** R2
- **note:** Full value of Policy A (seam execution in isolation) requires subagent infra (ADL-10). Without it, decomposition is a checklist the agent follows in the same context — spiral risk remains.
- **id:** R3
- **note:** VALIDATED. Policy B fires on tool call auth failures (clean exit, not semantic spiral). Resume specificity confirmed: agent writes exact tool + error + expected vs actual, not generic stuck message. Tested 2026-04-30 via context_reindex denial.
- **id:** R4
- **note:** RESOLVED. Policy A now includes a depth guard (step 0): if current anchor depth >= TWIN_DECOMPOSE_MAX_DEPTH (default: 3), fire Policy B instead of decomposing. Depth 3 is the empirically observed limit of human comprehension without external decomposition. See ADL-13 for full tree traversal pattern.

### Smoke Tests

- **mixed_signal_priority:** PASSED 2026-04-30 — policy_find(['complex','stuck']) returns A before B (score:1 tie broken by priority)
- **policy_b_auth_guard_r3:** PASSED 2026-04-30 — context_reindex denied twice, resume contained exact tool+error+expected vs actual

### Next Steps

Prototype a real decomposition using the full tree pattern (ADL-13) — root anchor + child seam anchors + post-order integration.
