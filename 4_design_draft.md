# Design draft

MODE: Design

## Prior stage output

[Selected approach from EXPLORE phase — or, on a review loop-back per `5_critical_review.md`'s Lifecycle, the prior draft plus the blocking finding(s) that must be addressed in this revision]

## Request

Produce draft #1 of a proposed solution suitable for review.

Include (if applicable):
- design overview
- affected components
- algorithm outline
- pseudocode or code
- migration or compatibility considerations

On a review loop-back (prior stage output includes blocking findings from a prior review round), state explicitly how each blocking finding was addressed in this revision — don't silently fold the fix in without naming it, since the next review round needs to verify the specific gap was actually closed, not just that the draft changed somehow.

## Lifecycle

On completing this stage:
1. Emit `[STAGE_COMPLETE | stage=DESIGN | summary=<one sentence>]`
2. **Save the full draft to a file** — `/Users/sladjan/Downloads/personal_docs/design_drafts/ticket-<ID>-<slug>.md`, before offering to anchor. Never the target repo or the twin repo — same reason as `test_plans/`: these mirror project-sensitive ticket/design detail and must stay out of any git history. Critical Review dispatches to a subagent with no access to this session's context; it needs this file, not a summary. Skipping this step means the full draft is unrecoverable once compressed below, including across a session boundary (e.g. resuming via `anchor_load`).
3. Offer: "Ready to move to Critical Review. Anchor this stage first?"
4. On confirm → produce compressed handoff for *this session's* resume: 3 sentences max — design decision, key trade-offs accepted, open questions for review, plus the `design_drafts/` file path. Paste the 3-sentence summary as `[Prior stage output]` in `5_critical_review.md`. Drop all draft iterations and discarded options from your own working context — but never from the saved file.
5. On decline → proceed with full context.
