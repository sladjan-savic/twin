# 7. Recursive Seam Decomposition Tree

- **Status:** implemented
- **Originally:** ADL-13 (twin's internal SQLite ADL store)
- **Type:** traversal-pattern

---

## Context

Addresses ADL-12 R4. When Policy A fires on a seam that is itself too complex, decompose recursively. The full structure is a tree traversed post-order: leaves first, integrate back up to root.

## Decision

### Core Insight

Depth limit is not arbitrary — it is grounded in human comprehension. Three levels is the observed limit beyond which humans cannot hold the full model simultaneously. At depth >= 3, further decomposition yields more complexity than it resolves; escalation to a human is more effective. TWIN_DECOMPOSE_MAX_DEPTH defaults to 3.

### Traversal

- **order:** post-order DFS — complete and integrate children before returning to parent
- **drill_down:** Policy A fires on current seam → find seams within it → create child anchors (parent_id + depth+1) → work leaves first
- **integrate_up:** all siblings completed → parent next[] becomes ["integrate"] → parent picks up children's delta fields → integrates → marks itself completed → signals its parent
- **progress:** parent.next[] shrinks as child anchors complete (each child atomically pops itself on save) — EDA-style, no monolithic state blob

### Anchor Schema Additions

- **parent_id:** anchor_id of the parent seam, null for root
- **depth:** integer, 0 = root, increments per level
- **note:** Implemented in v5/v6 migrations. All other fields (status, next, resume, delta) support this pattern unchanged.

### Anchor Shape

- **example:**
  - **root:** anchor-fn-process-order (depth=0, parent_id=null)
  - **children:**
    - anchor-seam-validate (depth=1, parent_id=root) → completed
    - anchor-seam-transform (depth=1, parent_id=root) → in-progress
    - anchor-seam-persist (depth=1, parent_id=root) → pending
  - **grandchildren:**
    - anchor-seam-transform-normalize (depth=2, parent_id=anchor-seam-transform) → completed
    - anchor-seam-transform-enrich (depth=2, parent_id=anchor-seam-transform) → in-progress

### Context Loading

- **principle:** Each anchor loads only the context for its seam. Parent does not need internals of children — only their status and output summary.
- **on_drill_down:** Load child anchor + its orientation map slice. Parent context stays loaded but backgrounded.
- **on_integrate_up:** Load parent anchor. Pull completed children's delta fields as integration inputs. Child full context not needed.

### Integration Contract

- **child_must_produce:** delta field: concise summary of what was completed and what the output is (not how)
- **parent_consumes:** child delta fields as inputs to integration step
- **rationale:** Parent needs outputs, not internals. delta is the interface boundary between levels.

### Depth Limit

- **config:** TWIN_DECOMPOSE_MAX_DEPTH
- **default:** 3
- **enforcement:** Policy A step 0 (depth guard): if current anchor depth >= limit, fire Policy B instead
- **rationale:** 3 levels is the empirically observed limit of human comprehension without external decomposition. Beyond that, a human reviewer cannot hold root + two levels of children simultaneously — escalation becomes more effective than further recursion.

### Sibling Completion Detection

- **mechanism:** Orchestrated consumer — parent owns the queue (next[]); each child is a producer
- **implementation:** saveAnchor(status=completed, parent_id=X) atomically: saves child, pops child anchor_id from parent next[], sets parent next=["integrate"] if list empties
- **signal:** Parent resumes and sees next=["integrate"] — all siblings done, delta fields available for integration
- **atomicity:** writeBatchWithFailover — child save + parent next[] update in one SQLite transaction

### Orphan Cleanup

- **trigger:** saveAnchor(status=closed|abandoned)
- **implementation:** Recursive CTE cascade-delete: walks full descendant tree, deletes all non-completed descendants in one transaction
- **rule:** Completed children survive (they are outputs). Non-completed children at any depth are deleted.
- **atomicity:** writeBatchWithFailover — parent save + recursive DELETE in one SQLite transaction

### Integration with ADL-10

Each child anchor maps to one subagent (ADL-10). Subagent loads child anchor on init, works the seam, writes delta + status=completed, exits. Parent agent resumes when next=["integrate"]. Concrete spawn mechanic: Agent(subagent_type=general-purpose, prompt includes #{child-tag} + /twin-start instruction). Integration mechanic: anchor_load each completed child, extract delta, synthesise, write anchor_save(completed) on current anchor.

### Integration with ADL-12

Policy A fires independently at each level. A seam that triggers Policy A at depth=2 spawns depth=3 children — it does not bubble up to the root. At depth=3, Policy A's depth guard fires Policy B instead.

## Consequences

### Cross-References

- **ADL-25:** ADL-25 (Structured Return Contract for Subagent Dispatches) generalizes this ADL's delta-field interface-boundary pattern to ad-hoc Agent-tool dispatches outside the decomposition tree (e.g. the software-architect review dispatch). Decomposition children keep using delta as-is; ADL-25 governs the separate, non-decomposition dispatch surface.

### Risks

- **id:** R1
- **note:** Orphaned child anchors if a parent is abandoned mid-decomposition. RESOLVED: saveAnchor(closed|abandoned) runs a recursive CTE cascade-delete of all non-completed descendants in one transaction.
- **id:** R2
- **note:** Integration quality depends on delta specificity. A vague delta ('did the transform stuff') breaks the parent's ability to integrate. Same contract as Policy B resume specificity — delta must state what was produced, not what was attempted. Open — enforced by convention, not code.
- **id:** R3
- **note:** RESOLVED. Depth can grow unbounded if Policy A has no termination guard. Fixed: Policy A step 0 checks depth >= TWIN_DECOMPOSE_MAX_DEPTH (default 3); fires Policy B instead of decomposing further.

### Next Steps

Complete. Real decomposition prototype verified E2E (2026-04-30): ADL-10 impl anchor decomposed into two child seams, worked post-order, integrated at root. Sibling completion detection, atomic pop, and integrate transition all confirmed working.

## Open Questions

### Open Questions
