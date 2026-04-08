# Ticket analysis

MODE: Analysis

## Task context

- Ticket [link]
- Title [title]
- Summary [usually the ticket summary]

## Request

1. Explain the problem in your own words
2. Identify assumptions
3. Identify missing information
4. Highlight potential risks or edge cases

## Output format

- Problem understanding
- Key assumptions
- Missing context
- Risks / edge cases

## Lifecycle

On completing this stage:
1. Emit `[STAGE_COMPLETE | stage=ANALYSIS | summary=<one sentence>]`
2. Offer: "Ready to move to Architecture Exploration. Anchor this stage first?"
3. On confirm → produce compressed handoff: 3 sentences max — problem statement, key assumptions, top risks. Paste as `[Prior stage output]` in `3_architecture_exploration.md`. Drop all remaining reasoning.
4. On decline → proceed with full context.
