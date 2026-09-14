# 19. Structured Return Contract for Subagent Dispatches

- **Status:** proposed
- **Originally:** ADL-25 (twin's internal SQLite ADL store)
- **Tag:** #SUBAGENT-RETURN-CONTRACT
- **Type:** execution-control

---

## Context

From the author's personal engineering backlog (not included in this repo; cross-referenced against Claude Certified Architect guide Domain 4.3, 9.3, 10.3), flagged as a gap to close. 5_critical_review.md's software-architect dispatch has no return schema -- 'Relay the agent's findings to the user as this stage's output' is the entire contract. Inconsistent with ADL-13's delta-field contract for decomposition children, and in tension with ADL-10's stated invariant ('schema validation before merge... invalid state is discarded, fail-fast').

### Scope

- **applies_now:** 5_critical_review.md's software-architect dispatch (this ADL's originating case).
- **applies_later:** Any other stage doc that dispatches a subagent via the Agent tool outside the ADL-13 decomposition tree (e.g. twin-explore, twin-analyse) -- adopted individually when that stage doc is next touched, not as a batch migration.
- **does_not_apply_to:** ADL-13 decomposition children, which already have their own contract (delta field).

## Decision

### Core Insight

Ad-hoc subagent dispatches (Agent tool calls that are not ADL-13 decomposition children) need the same kind of interface boundary ADL-13 gives decomposition children via 'delta' -- a small, fixed shape the dispatching session can rely on, independent of the agent's prose.

### Contract

- **shape:** { summary: string, findings: [{ severity: 'blocking'|'major'|'minor', area: string, description: string }], blocking: bool }
- **summary:** One-paragraph synthesis of the dispatch's overall verdict.
- **findings:** Zero or more concrete findings. area is free text (e.g. 'concurrency', 'performance', 'enum-hygiene') -- not a fixed enum, since dispatch prompts vary per stage doc.
- **blocking:** true iff at least one finding has severity 'blocking'. Redundant with findings but gives the dispatching session -- and, per backlog item 12, a future review-loop-back -- a single field to branch on without scanning the array.

### Enforcement

Convention only, matching ADL-13 R2 ('delta must state what was produced... enforced by convention, not code'). The stage doc instructs the subagent to return only this JSON shape; the dispatching session relays/reads it as-is. No parser or schema validation added -- that would be new infrastructure, out of scope for this item's Next-tier classification. Drift from the shape is a prompt-quality problem to fix in the dispatch instructions, not a runtime failure to catch in code.

## Consequences

### Cross-References

- **ADL-13:** ADL-13's delta field is the equivalent interface-boundary contract for decomposition children specifically. ADL-25 gives the same kind of fixed shape to ad-hoc Agent-tool dispatches outside that tree. Not in tension -- different write surfaces (decomposition children vs. standalone subagent calls).
- **ADL-10:** ADL-10 states the general invariant ('schema validation before merge... invalid state discarded, fail-fast') this ADL is motivated by, but ADL-25 deliberately stops short of ADL-10's fail-fast enforcement -- see 'enforcement' above. ADL-25 is the convention-level contract; runtime validation remains unimplemented and out of scope here.

### Risks

- **id:** R1
- **note:** Convention-only enforcement means a subagent can still return free prose instead of the JSON shape, and nothing catches it automatically. Same open risk ADL-13 R2 already accepts for delta. Mitigated by the dispatch prompt being explicit ('return ONLY this JSON shape').

### Next Steps

Amend 5_critical_review.md's Dispatch/Output-format sections to require this shape (this session, done). Batch 2 item 12 (review-design loop-back) is gated on this ADL existing, since it needs the blocking field as a loop signal.
