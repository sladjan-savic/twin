# Critical review

MODE: Review

## Dispatch

Run this review via the `software-architect` subagent (Agent tool) — not inline in the main session.

Rationale: the design was authored in this session. A detached reviewer with no authorship stake avoids rubber-stamping its own work.

Prompt the agent with:
- The **full, uncompressed design draft** — read it from `/Users/sladjan/Downloads/personal_docs/design_drafts/ticket-<ID>-<slug>.md`, saved during the design stage, not the 3-sentence handoff. The agent has no access to session context, so a compressed summary starves it of the detail (algorithm outline, pseudocode, affected components) needed to catch concurrency/performance/batching issues. If the file doesn't exist (e.g. an older session that predates this convention), stop and ask the user to paste the full draft before dispatching — do not proceed with just the compressed handoff.
- The original ticket/problem statement the design must satisfy.
- An explicit instruction to default to skepticism: assume the design has at least one real flaw and the agent's job is to find it, not to bless it. A clean review is a valid outcome, but only after an active attempt to break the design — not a courtesy pass.
- The `## Request` and `## Output format` sections below, verbatim, as its task.

The agent must return only the JSON shape defined in `## Output format` below (ADL-25's subagent dispatch return contract) — no prose wrapper. Relay it to the user as this stage's output, then continue with `## Lifecycle` below in the main session.

## Prior stage output

[Design draft from DESIGN phase — loaded in full from `/Users/sladjan/Downloads/personal_docs/design_drafts/ticket-<ID>-<slug>.md`, see Dispatch above]

## Request

Critically evaluate the proposed design.

Focus on:
- edge cases
- failure modes
- concurrency issues
- performance risks
- maintainability
- external API call patterns — are calls made per-item in a loop? Ask: does this API accept multiple inputs at once?
- hardcoded string constants that shadow existing enums (use `.name` instead of `"KH"`)
- behavioral changes when switching from per-request to batch — single-item failure vs whole-batch failure must be explicit

**Real vs superficial finding** — a finding must name a concrete scenario and tie it to an explicit gap in the design, not gesture at a general best practice:
- Superficial: "Consider adding more logging." — no failure mode named, nothing to confirm or refute.
- Real: "The batch write in Step 3 has no partial-failure handling — if item 4 of 10 fails validation, does the whole batch roll back or do items 1–3 persist? The design doesn't say." — names a concrete input, a concrete branch point, and the specific place the design is silent on it.

## Output format

Return ONLY this JSON shape (ADL-25):

```json
{
  "summary": "one-paragraph synthesis of the overall verdict",
  "findings": [
    { "severity": "blocking" | "major" | "minor", "area": "...", "description": "..." }
  ],
  "blocking": true | false
}
```

Use `area` to categorize each finding — e.g. edge case, failure mode, concurrency, performance, maintainability, batching opportunity, enum/constant hygiene. `blocking` is `true` iff at least one finding has `severity: "blocking"`. A clean review returns an empty `findings` array and `blocking: false` — not omitted fields.

## Lifecycle

On completing this stage:

1. Emit `[STAGE_COMPLETE | stage=REVIEW | summary=<one sentence>]`
2. **If `blocking: false`** (no blocking findings — accepted major/minor findings are fine):
   - Offer: "Ready to move to Test Plan. Anchor this stage first?"
   - On confirm → produce compressed handoff: 3 sentences max — review verdict, any accepted findings, residual risks. Paste as `[Prior stage output]` in `6_test_plan.md`.
   - On decline → proceed with full context.
3. **If `blocking: true`** — do not proceed to Test Plan. Instead:
   - Relay the blocking finding(s) to the user in full.
   - Track a review-round counter for this design, starting at 1 on the first dispatch (round-tripping design↔review counts as increments; this is session-local bookkeeping, not a stored field).
   - If the counter is below 3, ask: "Blocking finding(s) above. Address and re-review, or override and proceed to Test Plan anyway?"
     - **Address** → increment the counter; return to `4_design_draft.md` with the blocking finding(s) appended to its `[Prior stage output]` as required fixes; produce a revised draft; overwrite the same `design_drafts/ticket-<ID>-<slug>.md` file (per `4_design_draft.md`'s own Lifecycle); re-run this stage's Dispatch against the revised draft.
     - **Override** → append a note to the design draft file itself (not just this session) stating which blocking finding(s) were accepted as a known, deliberate risk and why; then proceed via step 2's handoff.
   - If the counter has reached 3 without resolution, stop looping automatically — three rounds of design↔review without convergence is the point where a human decision is more effective than a fourth automated cycle (same rationale as ADL-13's decomposition depth limit). State this plainly and ask the user to decide directly, rather than offering another "address or re-review" cycle.
