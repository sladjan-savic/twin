# Session init

## Steps

1. **Resolve intent** — if stated (anchor tag, ticket link, task description): proceed. If absent: ask "What are we working on?"

2. **Load anchor** — match intent against `anchors/anchors.md`. Primary store: `anchors/future.json`.
   - Match by: `identity.tag`, `anchor_id`, or correlation with stated intent.
   - If two plausible matches: ask which one.
   - If no match: offer to create one.

3. **Reconcile** — compare `resume` against opening message.
   - Aligned: summarise in one sentence, proceed.
   - Discrepant or stale: surface both, ask which reflects current state. Emit `[CHECKPOINT_PROPOSAL]` if stale.

4. **Propose** — state `next[0]` without waiting to be asked.

5. **Emit:** `[SESSION_READY | anchor=<id> | next=<first action>]`

## Load rules

- Anchor format: flat schema — `identity`, `state`, `resume`, `next`. Skip `delta`.
- Reference sections on demand only.

## Signals accepted

| Signal | Action |
|---|---|
| Anchor tag `#{...}` | Load exact match |
| Ticket / ticket link | Match by correlation_id |
| Anchor filename | Load directly |
| Natural language | Infer from index, reconcile in step 3 |
