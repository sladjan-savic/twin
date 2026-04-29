# Session init

## Steps

1. **Resolve intent** — if stated (anchor tag, ticket link, task description): proceed. If absent: ask "What are we working on?"

2. **Load anchor** — call `context_search(intent)` to get ranked L0 results across all stores.
   - Inspect results: pick the top anchor match; surface any co-relevant ADLs, policies, or orientation maps as context.
   - Load full anchor content with `anchor_load` only after confirming the match.
   - If two plausible anchor matches: ask which one.
   - If no match: offer to create one.

3. **Reconcile** — compare `resume` against opening message.
   - Aligned: summarise in one sentence, proceed.
   - Discrepant or stale: surface both, ask which reflects current state. Emit `[CHECKPOINT_PROPOSAL]` if stale.

4. **Propose** — state `next[0]` without waiting to be asked.

5. **Emit:** `[SESSION_READY | anchor=<id> | next=<first action>]`

## Load rules

- Anchor format: flat schema — `identity`, `state`, `resume`, `next`. Skip `delta`.
- Co-relevant results from `context_search` (ADLs, policies, orientation maps): load L0 only; do not hydrate full content unless confirmed needed during the session.
- Reference sections on demand only.

## Signals accepted

| Signal | Action |
|---|---|
| Anchor tag `#{...}` | Load exact match |
| Ticket / ticket link | Match by correlation_id |
| Anchor filename | Load directly |
| Natural language | Infer from index, reconcile in step 3 |
