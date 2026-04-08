# Critical review

MODE: Review

## Prior stage output

[Design draft from DESIGN phase]

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

## Output format

- key risks
- failure modes
- performance considerations
- batching opportunities
- enum / constant hygiene
- suggested improvements
