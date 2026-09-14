# 20. context:fork Investigation for twin-explore Isolation — Findings

- **Status:** closed
- **Originally:** ADL-26 (twin's internal SQLite ADL store)
- **Tag:** #FORK-ISOLATION-FINDINGS
- **Type:** investigation

---

## Context

From the author's personal engineering backlog (not included in this repo; cross-referenced against Claude Certified Architect guide Ch.5.5). Original premise: twin-explore runs inline in the main Claude Code session, so verbose Grep/Read investigation output accumulates directly in the main context. Proposed fix: a 'context: fork' mechanism to isolate the investigation while retaining anchor-write access at the end. This ADL records what was actually found when tested, 2026-07-23.

## Decision

### Conclusion

The capability twin-explore would need (fork the current interactive session, isolate verbose investigation, retain MCP write access at the end) is real -- but only reachable from a custom Agent SDK application (fork_session=True), not from anything twin-explore can invoke as a slash command inside an interactive Claude Code session today. The Agent tool's subagent_type: 'fork' (available inside interactive sessions) is a namesake, not the same mechanism -- it does not inherit context (F2). There is currently no interactive-session equivalent of fork_session.

### Disposition

twin-explore is NOT restructured. No interactive mechanism exists to restructure it onto. Batch 2 item 9 closes with this findings record. If ADL-20 is ever reactivated for an unrelated forcing function, fork_session should be evaluated then as a way to give exploration-heavy stages (twin-explore, twin-analyse) isolated, divergent sessions with full context -- addressing the isolation goal this item originally sought.

## Consequences

### Findings

- **id:** F1
- **claim_tested:** 'context: fork' as YAML frontmatter on a Claude Code slash command/skill.
- **result:** DOES NOT EXIST. Checked via claude-code-guide research against Claude Code CLI docs/help output and this repo's existing frontmatter usage (description/model/argument-hint, per ADL-20's step_1). No such key is documented or recognized.
- **id:** F2
- **claim_tested:** The Agent tool's subagent_type: 'fork' parameter copies the parent session's conversation context into the new dispatch.
- **result:** EMPIRICALLY DISPROVEN. Spawned a subagent_type: 'fork' agent and asked it to report the current meta-anchor's anchor_id and the last-completed backlog item number, without supplying that information in the prompt. It correctly declined to guess, stating it had zero access to prior conversation turns. Confirmed MCP write access separately: it successfully called anchor_save and the write persisted (test anchor fork-isolation-test-2026-07-23).
- **id:** F3
- **claim_tested:** A genuine 'fork_session' primitive exists in the Claude ecosystem (raised after a Google AI Overview described client.fork_session() and an interactive /fork CLI command).
- **result:** PARTIALLY REAL, DIFFERENT SURFACE. User supplied the official code.claude.com/docs/en/agent-sdk/sessions page. fork_session=True (paired with resume=<session_id>) is a real, documented option field on ClaudeAgentOptions/Options -- it copies a session's full conversation history into a new session with its own ID, diverging from that point. This is a legitimate context-copying fork mechanism -- but it is an Agent SDK primitive, set programmatically via query()/ClaudeSDKClient calls in a custom Python/TypeScript application that manages its own session IDs. The official docs describe no interactive /fork slash command for a live Claude Code CLI session -- that specific claim in the AI Overview remains unconfirmed and was not found in the official docs or via claude-code-guide's separate CLI-help check.

### Cross-References

- **ADL-20:** ADL-20 proposes SDK-direct as a second runtime for programmatic flows, deferred pending a forcing function. fork_session is a concrete SDK-only capability that falls under that proposal's scope -- see relationship_to_adl20.

### Next Steps

No action. Revisit only if ADL-20 reactivates.

## Additional Detail

### Relationship To ADL-20

Concrete instance of ADL-20's general framing: SDK-only capabilities (cache_control breakpoints, structured tool-use output, and now fork_session) are unreachable from twin's current pure-interactive-Claude-Code runtime, and become reachable only if/when ADL-20's proposed SDK-runtime step_2 activates. ADL-20 R4 explicitly defers that migration pending 'a concrete programmatic flow' as forcing function -- this finding does not on its own constitute that forcing function; it is one more capability that would become available, not evidence migration is now justified.
