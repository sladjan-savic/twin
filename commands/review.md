---
description: Critically review the design — adversarial check before implementation
model: claude-opus-5
---

Follow ${CLAUDE_PLUGIN_ROOT}/5_critical_review.md exactly. Stage docs it names by bare filename (e.g. `5_critical_review.md`) are in `${CLAUDE_PLUGIN_ROOT}/`. Dispatch the review itself to the `twin:software-architect` subagent per the Dispatch section — pass it the full design draft, not the compressed handoff.

## Editing this output later

What this command produces is a generated artifact: composed from the spec above plus session data. If asked to change it afterwards, default to regenerating rather than patching:

1. **Regenerate from spec** — re-run the spec with adjusted input or context and rewrite the output in full. Use when the problem is a generation pattern (wrong section emphasis, a missed item, an overstated risk).
2. **Fix the spec, then regenerate** — when the problem exposes a methodology gap. Edit the relevant `N_<stage>.md`, then regenerate. Stage docs are authored files, so a surgical edit to them is correct; make it in the twin source repo, since an installed plugin copy is replaced on update.
3. **Surgical edit** — only when the change is genuinely local and outside the spec's scope (a user-supplied phrasing tweak in one sentence, a typo).

When unsure, ask: "Regenerate from spec, fix the spec, or one-off edit?" A surgical edit to generated output drifts from what the spec would now produce, and the next regeneration silently reverts it.
