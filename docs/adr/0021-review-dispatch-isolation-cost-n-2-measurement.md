# 21. Review-Dispatch Isolation Cost — N=2 Measurement

- **Status:** closed
- **Originally:** ADL-27 (twin's internal SQLite ADL store)
- **Tag:** #REVIEW-DISPATCH-COST-MEASUREMENT
- **Type:** investigation

---

## Context

From the author's personal engineering backlog (not included in this repo), flagged as a gap to close. No measurement existed of whether the software-architect subagent dispatch (5_critical_review.md's Dispatch section) catches more flaws than an inline review would, against its added cost (fresh context load, no cache-sharing with the main session, single non-parallel call). This ADL records an actual N=2-per-condition measurement, run 2026-07-23.

## Decision

### Fixture

- **draft:** ticket-181954501-assign-reviewers.md (41KB, draft #5 -- already the second critical-review round, most substantive available draft)
- **unplanned_confound:** The draft describes a feature that, unknown at experiment design time, was already implemented and merged into the target backend repo (a feature branch, two commits -- verified real via git log/git show, not agent-fabricated). Both dispatched trials independently discovered and reviewed the shipped code rather than treating the draft as a pending hypothetical design. This changes what the experiment measures: not 'finds bugs in an unimplemented design' but 'finds doc/reality drift when reality is available to check' -- still a valid and arguably more realistic scenario, since software-architect has the same Read/Grep/Bash access to sibling repos as any dispatch in this project, and real critical-review dispatches often do have a shippable branch to check against.

### Conclusion

On this fixture, dispatching to software-architect did not catch anything an inline reviewer couldn't, once the inline reviewer was instructed to verify claims against real code rather than trust the draft's prose (M1). The dispatch mechanism's actual advantages that held up empirically: precise, self-reported cost accounting (M3, in dispatch's favor as a instrumentation win, not a cost win) and independent investigation initiative without being told to (M2 trial 2's unprompted decompile-a-jar move) -- speculative whether that same initiative would occur inline if not explicitly instructed. Its actual disadvantage: full fresh-context cost every trial, non-trivial latency variance up to ~18 minutes on one trial. This does not settle the general question (see measurement_limitations) but is a real, if narrow, data point: for a review whose main risk is doc/reality drift, an inline review with an explicit 'verify against the real code' instruction is a plausible zero-marginal-dispatch-cost substitute.

## Consequences

### Trials

- **dispatched_1:**
  - **subagent_tokens:** 73050
  - **tool_uses:** 37
  - **duration_ms:** 184362
  - **findings_count:** 2
  - **severities:**
    - minor
    - minor
  - **blocking:** False
- **dispatched_2:**
  - **subagent_tokens:** 86709
  - **tool_uses:** 45
  - **duration_ms:** 1065146
  - **findings_count:** 4
  - **severities:**
    - minor
    - minor
    - minor
    - minor
  - **blocking:** False
  - **note:** Decompiled an external dependency's sources jar (an internal auth-API class) to verify the real 404-propagation behavior of its user-auth-lookup method -- went further than trial 1's investigation depth on its own initiative, same prompt.
- **inline_1:**
  - **tokens:** not independently measurable from inside the main session -- no per-turn token counter exposed to the model itself, unlike the Agent tool's subagent_tokens field for dispatches. This asymmetry is itself a finding, see measurement_limitations.
  - **tool_uses:** 0
  - **approach:** prose-only, no verification against real code -- represents a 'typical inline' pass that trusts the draft's own claims
  - **findings_count:** 2
  - **severities:**
    - minor
    - minor
  - **blocking:** False
  - **note:** Found generic doc-quality nits (race-magnitude not quantified, fold-invariant comment) -- did NOT surface the documentation-drift finding both dispatched trials caught, because it never checked the draft's claims against the real code.
- **inline_2:**
  - **tokens:** not independently measurable, see above
  - **tool_uses:** 3
  - **approach:** deliberately matched dispatched trials' depth -- checked git log/git show for the real diff, grepped for the assignment method's real callers
  - **findings_count:** 2
  - **severities:**
    - minor
    - minor
  - **blocking:** False
  - **note:** Converged on the identical core finding (the assignment method's caller-count claim is inaccurate; its implementation's real signature diverges from the doc's algorithm outline) once given comparable tool access and asked to verify rather than trust the prose.

### Findings from Measurement

- **id:** M1
- **note:** Depth is not a fixed property of dispatched-vs-inline -- it's a property of whether the reviewer (dispatched or inline) chooses to verify claims against real code. inline_1 (shallow, prose-only) missed the real bug entirely; inline_2 (deep, code-checking) and both dispatched trials all found it. The dispatch mechanism itself did not add value here -- the verification behavior did, and that behavior is available inline too. This directly contradicts the premise that isolation (fresh context, no main-session distraction) is what makes software-architect dispatches valuable; instructing an inline reviewer to verify against real code produced the same result at zero dispatch overhead.
- **id:** M2
- **note:** High variance between two 'identical' dispatched trials on the same prompt: 5.8x latency (184s vs 1065s), 19% more tokens, 22% more tool calls, 2x findings count. Software-architect's investigation depth is not deterministic call-to-call -- trial 2's extra effort (decompiling an external sources jar) came from the agent's own initiative, not a difference in instructions. A single dispatched trial is not representative; N=1 (as this backlog item's own alternative framing warned against) would have been badly misleading depending on which trial landed.
- **id:** M3
- **note:** Token cost is only measurable for the dispatched condition (Agent tool's subagent_tokens field). Inline review cost has no equivalent introspection available to the model itself within a session -- this is a real measurement-asymmetry limitation, not a resolved question. The isolation-cost comparison this item asked for is therefore incomplete on the cost side: dispatched cost is precisely known (73k-87k tokens per trial here); inline cost is unknown and could plausibly be higher (main session already carries full prior context, so an inline review's marginal tokens are just the review text itself, likely much less than 73k-87k) or lower — no instrument exists to check which.
- **id:** M4
- **note:** The 'no cache-sharing with the main session' cost claim from this item's original framing held up: dispatched trials paid full fresh-context cost for a 41KB draft plus system prompt (~500 lines) plus repo exploration, each and every trial, independently. An inline review reuses this session's already-loaded context (the draft was already read into this session for the AskUserQuestion fixture-selection step) -- a real, uncontested cost advantage for inline, even though it doesn't show up as a directly comparable number per M3.

### Measurement Limitations

- N=2 per condition, one fixture. Not enough trials to establish a stable distribution, especially given M2's observed 5.8x dispatched-trial variance -- this is a directional signal, not a statistically confident measurement.
- The fixture's confound (already-shipped code, not a pending design) means this experiment measured 'doc-vs-reality drift detection,' not the broader class of design flaws critical review is meant to catch (concurrency bugs, missing edge cases, wrong constants) that this same draft's own revision history shows software-architect dispatches DID catch in earlier rounds (hard defects: wrong QC-assign state constant, substring-match cross-evaluation guard). This experiment cannot speak to whether dispatch adds value on a genuinely未-implemented design -- only on drift-detection against shipped code.
- Inline trials are not independent samples in the statistical sense -- both ran in the same continuous session, by the same model instance, with the researcher (this session) choosing each trial's investigation depth deliberately rather than each trial varying by fresh sampling the way two separate dispatches do. inline_1 vs inline_2's difference measures 'what happens if you tell the reviewer to check reality vs not,' not 'natural variance in two independent inline attempts.'

### Next Steps

Revisit with a genuinely-unimplemented design draft (no shipped-code confound) if a future ticket offers one at review time, to test the broader claim. Until then, no change to 5_critical_review.md's Dispatch section -- this single measurement is not strong enough evidence to remove or keep the dispatch requirement, and the rationale for dispatch (detached reviewer, no authorship stake, avoids rubber-stamping) was never about cost/thoroughness in the first place, so this finding doesn't actually contradict the stage doc's stated rationale even though it complicates the specific cost-justification framing this backlog item asked about.
