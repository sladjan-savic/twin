# Architecture exploration

MODE: Exploration

## Prior stage output

[Summary from UNDERSTAND phase]

## Request

Explore possible approaches to solving this problem.

For each approach provide:
- description
- advantages
- disadvantages
- architectural risks
- compatibility with existing constraints

## Output format

Approach 1
Approach 2
...
Approach N

## Lifecycle

On completing this stage:
1. Emit `[STAGE_COMPLETE | stage=EXPLORE | summary=<one sentence>]`
2. Offer: "Ready to move to Design Draft. Anchor this stage first?"
3. On confirm → produce compressed handoff: 3 sentences max — selected approach, core rationale, constraints it must respect. Paste as `[Prior stage output]` in `4_design_draft.md`. Drop all rejected approaches and their reasoning.
4. On decline → proceed with full context.
