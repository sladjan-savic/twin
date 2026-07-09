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

Relay the agent's findings to the user as this stage's output, then continue the lifecycle below in the main session.

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

## Output format

- key risks
- failure modes
- performance considerations
- batching opportunities
- enum / constant hygiene
- suggested improvements
