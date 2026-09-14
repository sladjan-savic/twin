# 16. Anchor Freshness Sweep as Weekly Report Pre-check

- **Status:** proposed
- **Originally:** ADL-22 (twin's internal SQLite ADL store)
- **Type:** behavioral

---

## Context

Anchors state observable facts about in-progress work: 'PR #X opened', 'analysis complete, next is design', 'waiting on review'. These facts go stale — a PR merges, a stage progresses, a blocker resolves — while the anchor sits unchanged. Stale anchors degrade weekly report quality. The window is small: 3-5 anchors per week max.

### Why Not Separate Command

A separate /twin-anchor-sweep skill or cron would require remembering to run it. The user flagged this explicitly: 'I could forget to pull.' Pre-check on weekly report eliminates the forget-me-not problem by piggybacking on an already-mandatory step.

### Why Not Auto Apply

Silent state changes to anchors lose the human-in-the-loop signal that motivated the design. User may want to explain a state change in the report narrative — auto-apply would remove that opportunity. Surfaced diff + confirm/skip is the right contract.

### Why Not Loop

/loop is an in-session recurring prompt, not a background scheduler. The fleet is too small (3-5 anchors) and the cadence too infrequent (weekly) to justify a loop primitive. The report pre-check is lighter and more natural.

## Decision

Fold the freshness sweep into the weekly report as Step 0, not a separate command or scheduled cron. The weekly report is already a forcing function — you have to run it, you have to review it. The sweep cannot be forgotten because the report is the trigger.

### Sweep Design

- **scope:** Anchors from the past 7 days where status NOT IN (completed, closed, blocked)
- **blocked_exclusion:** Anchors in 'blocked' state are intentionally paused by human decision — do not probe. Unblocked only on explicit user continuation.
- **probe_type:** Cheap, targeted fact-check against the claim the anchor itself states. Not a full re-evaluation.
- **claim_types:**
  - **claim:** PR opened
  - **check:** git log or ticket state — did it merge or close?
  - **claim:** Stage complete, next is X
  - **check:** git diff since anchor timestamp — did work appear?
  - **claim:** Waiting on reviewer / ticket state
  - **check:** one getProblemByIds call — did state change?
- **output:** Surfaced diff per diverged anchor: 'PR 142 merged — anchor says open. Patch?'. User confirms or skips each. Auto-apply is NOT used — human in the loop.
- **then:** Report generation proceeds with fresh anchor state.

### Placement

Step 0 in 8_weekly_report.md, before any report content is generated. Implementation: amend the stage doc, no new skill or command needed.

## Consequences

### Coverage Annotation

- **rationale:** From the author's personal engineering backlog (not included in this repo; cross-referenced against Claude Certified Architect guide Ch.10.4). Without this, a probe that can't complete (e.g. one ticket lookup times out) renders identically to a probe that ran and found no divergence — both simply produce no diff line. A partial sweep failure would silently present as a complete, trustworthy sweep. Added to the design before implementation starts.
- **states:**
  - **FULL:** Probe ran to completion and produced a definitive result (match or divergence) for the anchor's stated claim.
  - **PARTIAL:** Probe ran but only checked a subset of the claim (e.g. the claim type has multiple checkable facts and only some were reachable).
  - **FAILED:** Probe could not run at all for this anchor (timeout, error, API unavailable) — no signal obtained.
- **per_anchor:** Every anchor in the sweep's scope gets exactly one of these three tags before the confirm/skip list is shown to the user.
- **surfacing:**
  - **FULL_no_divergence:** Not shown — swept, confirmed fresh, no action needed.
  - **FULL_divergence:** Shown as the existing diff line ('PR 142 merged — anchor says open. Patch?').
  - **PARTIAL:** Shown, labeled 'partially checked' — treated as a divergence candidate even absent a confirmed diff, since incomplete data can mask staleness.
  - **FAILED:** Shown, labeled 'could not verify' — a distinct list entry, no diff computed, but never silently skipped. Options: skip / retry / proceed without checking.
- **scope:** Session-only, per user decision 2026-07-23. Does not propagate into the weekly report's content — once the user has acted on (or explicitly skipped) a FAILED/PARTIAL anchor, the report proceeds normally. The report stays about the week's work, not sweep mechanics.
- **interaction_with_R1:** PARTIAL/FAILED entries are exempt from R1's 'narrow the probe to reduce false positives' mitigation — they are not confident results in either direction, so the false-positive concern (which applies to FULL results) doesn't apply the same way.

### Escape Hatch

Sweep must be skippable (e.g. --skip-anchor-check arg or explicit user override) for the case where anchors are known-stale but report is needed without friction. Without this, a blocked-on-API anchor could prevent the report entirely.

### Non-Goals

- Full anchor re-evaluation (reasoning, risk reassessment). Scope is observable fact-checking only.
- Daily automated sweep. The weekly cadence matches the report cadence; daily is over-engineering for 3-5 anchors.
- Full coverage of all claim types from day one. Start with the two or three most common (PR state, stage progression, ticket state).
- Coverage annotation appearing in the weekly report's own content — it is a session-time signal only (see coverage_annotation.scope).

### Risks

- **id:** R1
- **note:** Sweep adds friction to the report flow if it surfaces many false positives. Mitigation: narrow the probe to claims the anchor explicitly states, not speculative checks.
- **id:** R2
- **note:** Missing escape hatch blocks report generation. Mitigation: skip flag is a hard requirement, not optional.
- **id:** R3
- **note:** Claim-type taxonomy needs to be kept simple. Over-engineering the probe logic defeats the 'cheap check' principle.

### Next Steps

Implement when ready: amend 8_weekly_report.md with Step 0 spec, including the coverage_annotation tagging and surfacing rules above. No new skill, no new command. Test on the next Friday report cycle.

## Additional Detail

### Implementation Notes

- **step_0_spec:** Find anchors (context_search, status filter, age filter) → for each: anchor_load, identify claim type, run one cheap check, tag FULL/PARTIAL/FAILED, surface diverged + PARTIAL + FAILED entries → user confirm/skip/retry → proceed to report
- **files_to_change:**
  - 8_weekly_report.md — add Step 0
- **no_new_files:** True
