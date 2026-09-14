# 17. Pivot: From Principle-First Learning Platform to Gradual Anthropic-System Alignment

- **Status:** decided
- **Originally:** ADL-23 (twin's internal SQLite ADL store)
- **Type:** strategic

---

## Context

Twin was built first-principles: custom anchor MCP, custom stage docs, custom SQLite schema, custom policy engine. The original purpose was a learning platform for the user's own cognitive-workflow principles — validated by building and iterating on them directly (see ADL-07, ADL-09, ADL-12, ADL-13). The user concluded some time before this date that this purpose had run its course: the principle-first approach stopped producing anything meaningful for them.

### Forcing Function

A structured assessment (2026-07-09, an internal assessment not included in this repo) compared twin's architecture against Anthropic's published agent-building guidance and native Claude Code mechanisms. It found twin's stage pipeline is a close match to Anthropic's 'prompt chaining' pattern, its memory design independently reinvents most of Anthropic's context-engineering playbook, and its review-dispatch subagent pattern is a partial match to orchestrator-worker/evaluator-optimizer patterns with a real gap (no structured return contract). This assessment is the first concrete instance of the alignment work this ADL commits to doing on an ongoing basis.

## Decision

Twin's direction shifts from 'invent and validate cognitive-workflow principles from first principles' to 'gradually align with Anthropic's own published/native agent-building system' — adopting Anthropic's patterns and native mechanisms where they already cover a need twin built bespoke, and reserving bespoke twin infrastructure for genuine gaps Anthropic's system doesn't address.

  This is a gradual pivot, not a rewrite: existing twin infrastructure (anchors, ADLs, policies, orientation maps, the 6-stage pipeline) stays in place and gets evaluated piece by piece against Anthropic's actual guidance, rather than being replaced wholesale on day one.

### Evaluation Method

For each twin subsystem: (1) identify what Anthropic-native mechanism, if any, covers the same need, (2) if a native mechanism covers it, evaluate whether twin's bespoke version adds something the native one doesn't (see ADL-24 for the first instance of this evaluation, applied to the anchor store vs. native Claude Code memory), (3) retire, narrow, or keep the bespoke version based on that evaluation — never keep bespoke infrastructure merely because it already exists.

## Consequences

### Non-Goals

- A wholesale rewrite onto Anthropic SDK or native mechanisms on a fixed timeline — 'gradually' is deliberate.
- Abandoning twin subsystems that have no native equivalent (ADLs, policies, orientation maps) without evaluating them first.
- Treating this pivot as a verdict that twin's earlier principle-first work was wasted — ADL-07 through ADL-22 remain the validated foundation being evaluated, not discarded.

### Risks

- **id:** R1
- **note:** Evaluating subsystem-by-subsystem risks stalling indefinitely with no subsystem ever fully retired. Mitigation: each evaluation should end in an explicit disposition ADL (keep/retire/narrow), not an open-ended note.
- **id:** R2
- **note:** Anthropic's published guidance changes over time; an alignment decision made today may need revisiting. Mitigation: disposition ADLs should cite the specific source/mechanism compared against and its date, so staleness is checkable later.

### Next Steps

Apply the evaluation method to each remaining twin subsystem (policy store, orientation maps, ADL store itself) as they come up for review. First instance already decided: ADL-24 (anchor store retained over native memory).
