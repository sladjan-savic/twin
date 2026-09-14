# 15. Edit Strategy: Regenerate Generated Artifacts, Surgical-Edit Authored Ones

- **Status:** standing
- **Originally:** ADL-21 (twin's internal SQLite ADL store)
- **Tag:** edit-strategy
- **Type:** principle

---

## Context

### Applies To

Any artifact in or out of the twin repo. Operational discipline for the cognitive harness.

Twin produces two distinct kinds of files. Generated artifacts (weekly entries, weekly reports, test plans, orientation maps, stage outputs) are composed from a spec doc + ticket data — they're snapshots of a generation process. Authored artifacts (code, ADLs after initial save, CLAUDE.md, the stage docs themselves) are written directly with no derivable spec. The right edit primitive differs.

### Why Surgical Edit Fails On Generated

Surgical edits drift the artifact away from its spec. Three outcomes: (1) next regeneration silently reverts the edit, frustrating the user; (2) the artifact becomes an inconsistent snapshot whose provenance is no longer trustworthy; (3) systematic issues in the spec are masked by per-instance fixes, never surfacing as the methodology gaps they actually are.

## Decision

### Principle

Match the edit primitive to the artifact's provenance. Artifacts composed from a spec + data are regenerated (full Write, Shadow-DOM commit style). Artifacts authored directly are surgical-edited (Edit after grep/symbol lookup).

### Generated Artifacts

- **examples:**
  - weekly entries (output of 7_weekly_entry.md)
  - weekly reports (output of 8_weekly_report.md)
  - test plans (output of 6_test_plan.md, under test_plans/)
  - orientation maps (composed via twin-orientate)
  - stage outputs during a twin session (analysis, exploration, design, review)
- **default_edit_strategy:** regenerate, full Write — Shadow-DOM commit
- **three_options:**
  - **option:** regenerate
  - **use_when:** the issue is a generation pattern (wrong section emphasis, missed an item, overstated a risk)
  - **option:** fix the spec, then regenerate
  - **use_when:** the issue exposes a methodology gap (e.g., the weekly report template never produced a 'blocked on' section)
  - **option:** surgical Edit
  - **use_when:** the change is genuinely local and out of spec scope (typo, user-supplied phrasing tweak in one sentence)
- **default_when_unsure:** ask: 'Regenerate from spec, fix the spec, or one-off edit?'

### Authored Artifacts

- **examples:**
  - code (any language, any repo)
  - ADLs after initial save
  - CLAUDE.md, README.md, rules files
  - stage docs themselves (0_*.md … 8_*.md)
- **edit_strategy:** surgical Edit after grep/symbol lookup. Full Write only when restructuring wholesale.

### Enforcement Layers

- **1_rule_file:** .claude/rules/edit_strategy.md — auto-loads in twin repo
- **2_feedback_memory:** feedback_edit_strategy.md — applies cross-session, including in other repos
- **3_subagent:** Not yet built. file-writer subagent with the discipline baked into its system prompt. Promote to this layer if rule + memory still drift.

## Consequences

### Tooling Alignment

- **Edit_tool:** surgical patch primitive — exact-string replacement, fails on ambiguity. Right for code and authored artifacts.
- **Write_tool:** full-rewrite primitive. The Shadow-DOM commit. Right for generated artifacts.
- **indexing_asymmetry:** Code benefits from indexed search (grep, symbol lookup, AST). Unstructured/semi-structured text is faster covered without indexing — read whole file, regenerate or edit globally.

### Failure Mode Documented

User reads a generated artifact (commonly a weekly report or test plan), finds something unexpected, asks for an edit. Reflex is to surgical-Edit the offending phrase. User reported (2026-06-18): 'I have to give a reminder from time to time, so there is a drift, although it mostly works as intended.' Rule is correct; enforcement is weak.

### Cross-References

- **ADL-09:** ADL-09's 'no diff/surgical edits' invariant is scoped to DB-record mutation (mcp/src/store/*.ts save* write paths) — not in tension with this ADL's surgical-Edit default for code and authored artifacts. The two ADLs previously used overlapping vocabulary ('diff', 'surgical edit', 'state replacement') without cross-referencing each other, creating an apparent contradiction. Resolved 2026-07-17: ADL-09 governs DB-record writes; ADL-21 governs code/authored-artifact writes. Different write surfaces, no actual conflict.
- **ADL-13:** twin-orientate already prescribes 'compose the complete file in memory before writing — no partial drafts.' ADL-21 generalizes that pattern to all generated artifacts.
- **ADL-20:** Anthropic SDK runtime ([ADR 0014](./0014-runtime-strategy-claude-code-interactive-anthropic-sdk-programmatic.md)) would naturally enforce regenerate-first via structured-output tool-use. Generated artifacts in SDK runtime are JSON-shaped; no surgical-edit surface to drift from.

### Non-Goals

- Eliminating surgical Edit on generated artifacts. The third option (one-off Edit for genuinely local changes) stays available.
- Defining a closed taxonomy. The generated/authored split is a heuristic; edge cases exist (e.g., a manually-curated test plan that started as generated).

### Next Steps

Watch for drift signals over 4-6 weeks. If user has to remind ≥3 times despite rule + memory, promote to file-writer subagent. Otherwise standing principle is sufficient.

## Open Questions

### Open Questions

- Should a pre-Write hook warn when about to overwrite a generated artifact recently surgical-edited? Likely no — too clever; hooks rot.
- Should the file-writer subagent be built proactively or only when drift is measured to persist? Current answer: only when measured.
