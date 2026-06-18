# Edit strategy: regenerate generated artifacts, surgical-edit authored ones

## Generated artifacts (composed from spec + data)

- Weekly entries (`7_weekly_entry.md` output) and weekly reports (`8_weekly_report.md` output)
- Test plans (`6_test_plan.md` output, written under `test_plans/`)
- Orientation maps (composed via `twin-orientate`, saved to twin store + `mermaids/`)
- Stage outputs during a twin session: analysis, exploration, design, review

## When the user asks to edit a generated artifact, default to regenerate

Three options, pick deliberately:

1. **Regenerate from spec** — re-run the spec doc with adjusted input or context, full `Write`. Shadow-DOM commit. Preferred when the issue is a generation pattern (wrong section emphasis, missed an item, overstated a risk).
2. **Fix the spec, then regenerate** — when the issue exposes a methodology gap (e.g., the weekly report template never produced a "blocked on" section). Edit the relevant `N_<stage>.md`, then regenerate.
3. **Surgical `Edit`** — only when the change is genuinely local and out of spec scope (e.g., user-supplied phrasing tweak in a single sentence, fixing a typo).

When unsure, ask: "Regenerate from spec, fix the spec, or one-off edit?"

## Why

Surgical edits to generated artifacts cause drift. The artifact diverges from what its spec would now produce; the next regeneration silently reverts the edit, or the artifact becomes an inconsistent snapshot whose provenance you can no longer trust.

## Authored artifacts

- Code (any language, any repo)
- ADLs after the initial save
- `CLAUDE.md`, `README.md`, this rules file
- Stage docs (the methodology files `0_*.md` … `8_*.md` themselves)

Surgical `Edit` after grep/symbol lookup is correct. Full `Write` only when restructuring wholesale.

## Failure mode this rule fixes

User reads a generated artifact (commonly a weekly report or test plan), finds something unexpected, asks for an edit. Without this rule, the default is to `Edit` the offending phrase. The artifact drifts from its spec. Documented case 2026-06-18.
