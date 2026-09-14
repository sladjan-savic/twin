# 23. Review→Design Loop-Back on Blocking Findings

- **Status:** implemented
- **Originally:** ADL-29 (twin's internal SQLite ADL store)
- **Tag:** #REVIEW-LOOPBACK
- **Type:** behavioral

---

## Context

From the author's personal engineering backlog (not included in this repo), flagged as a gap to close. Prior to this ADL, 5_critical_review.md was a single pass: the review ran once, its findings were relayed, and the stage doc's Dispatch section referenced 'the lifecycle below' -- text that did not exist anywhere in the file. There was no loop-back mechanism at all, and no stored signal (blocking) to loop on until ADL-25 added one. Gated on ADL-25 per the backlog item's own note.

## Decision

Added a `## Lifecycle` section to 5_critical_review.md (the file had none) with three components: (1) blocking:false proceeds exactly like every other stage doc's existing confirm/decline-anchor-then-handoff pattern; (2) blocking:true triggers a design<->review loop -- relay findings, ask the user to address-and-re-review or override-and-proceed, each iteration gated on explicit user confirmation (not automatic); (3) a 3-round cap, after which looping stops and the user is asked to decide directly rather than running a 4th automated cycle.

### Scope Decisions

- **confirmation_per_iteration:** User confirms each loop iteration rather than a fully automatic loop. Matches the existing confirm/decline pattern already used at every other stage transition (2_ticket_analysis.md, 3_architecture_exploration.md, 4_design_draft.md) -- introducing silent automation here would be the only stage doc that skips the human checkpoint, an inconsistency with no stated justification.
- **round_cap:** 3 rounds, then escalate. Directly reuses ADL-13's TWIN_DECOMPOSE_MAX_DEPTH=3 rationale: three rounds is the empirically-motivated point past which further automated iteration adds more process overhead than it resolves, and a direct human decision is more effective. This is bookkeeping tracked in-session (a counter the agent following the stage doc maintains across turns), not a new stored field or schema change -- no new infra needed, consistent with this item's classification.
- **override_allowed:** The user can override a blocking finding and proceed to Test Plan anyway. The override is not silent: it must be recorded as a note in the design draft file itself (not just the session), stating which finding was accepted as a known risk and why -- so a future reader of the draft file sees the accepted risk, not just a draft that happens to omit a fix.

## Consequences

### Non-Goals

- Automatic looping without user confirmation -- rejected per scope_decisions above.
- A hard gate with no override -- rejected; the user explicitly wanted an escape valve for accepted, documented risk.
- Any code/schema change -- this is entirely a stage-doc (prompt) amendment, no mcp/src changes, consistent with this item's 'no new infrastructure' Next-tier framing even though it shipped alongside item 11's Later-tier infra work in the same session.

### Cross-References

- **ADL-25:** This loop-back is gated on ADL-25's blocking field existing as the signal to loop on -- exactly the dependency the original backlog item named.
- **ADL-13:** Round-cap rationale borrowed directly from ADL-13's depth-limit reasoning (3 levels/rounds is the practical human-comprehension/process-overhead limit before escalation beats further automation).

### Risks

- **id:** R1
- **note:** The review-round counter is session-local prompt bookkeeping (the agent following the stage doc tracks it across turns), not a persisted field. If a session is interrupted and resumed via anchor_load mid-loop, the counter is lost and would restart at 1. Not fixed here -- would require a new anchor/schema field, which is out of scope for a stage-doc-only amendment. Acceptable given loop rounds are expected to complete within one continuous session.
- **id:** R2
- **note:** Override notes are appended to the design draft file by convention (instructed in the stage doc), not enforced by any validation -- a future session could still skip writing the override note. Same convention-not-code enforcement pattern already accepted for ADL-13's delta field and ADL-25's return contract.

### Next Steps

No further action. If a stored round-counter or persisted override-audit trail is ever needed (R1), that would be a new, separate ADL reactivating anchor schema work -- not needed today.

## Additional Detail

### Related Fix

The Dispatch section's dangling 'continue the lifecycle below in the main session' reference (pointing to nothing, pre-existing this session) is now accurate -- there is a Lifecycle section below it. Also added a short note to 4_design_draft.md's Request section: on a loop-back re-entry, the revised draft must state explicitly how each blocking finding was addressed, so the next review round can verify the specific gap was closed rather than just noticing the draft changed.
