# Weekly Report

Generate the full weekly work summary: Slack-format text, write to `weekly.txt`, append to the weekly JSON log.

---

## Input

- Week date range: accept as argument (e.g. `Jun 2–6`) or default to the current calendar week (Monday–Friday).
- If the week is not the current week, confirm before proceeding.

---

## Steps

### 0. Anchor freshness pre-check

Find anchors that may have gone stale since they were last saved.

**Skip this step entirely if the user passes `--skip-anchor-check`.**

1. Call `context_search` with query `"status:in_progress OR status:active"` to find candidate anchors. Filter to those updated more than 12 hours ago whose status is not `completed`, `closed`, or `blocked`.
2. For each candidate, call `anchor_load` and identify the **verifiable claim** the anchor states. Focus on the two most common cases:
   - *PR opened* — extract PR number or ticket ID, run `git log --all --oneline --grep="<id>"` to check if it merged or closed.
   - *Ticket state* — call the ticket tracker's fetch-by-ID tool and compare the stored state against current state/substate.
3. For each anchor where the claim diverged, surface a one-line diff to the user:
   ```
   [STALE] anchor-<id>: "PR #142 opened" — PR merged 2026-06-17. Patch?
   [STALE] anchor-<id>: ticket state was "Open/Active" — now "Verify/Fixed". Patch?
   ```
4. For each: wait for user to confirm (`y`) or skip (`n`). On confirm, call `anchor_save` with the updated field and status. On skip, leave unchanged.
5. Once all candidates are confirmed or skipped, proceed. If no candidates were found, emit `[ANCHOR-CHECK] All anchors current.` and continue.

**Note:** `blocked` anchors are intentionally paused by human decision — never probe or patch them automatically.

### 1. Determine the week

Compute Monday and Friday dates for the target week. Format: `Month D–D, YYYY`.

### 2. Gather ticket IDs worked this week

Search git log across all repos for commits in the date range:
```
git log --after="YYYY-MM-DD" --before="YYYY-MM-DD" --oneline --all
```
Run in each repo listed in `~/.claude/twin-repos.txt` (personal, gitignored — one absolute repo path per line):

Extract all ticket URL/ID references from commit messages (whatever format this environment's commit convention uses). Deduplicate.

Also check `/Users/sladjan/Downloads/personal_docs/worklog/weekly.txt` — if the existing file covers the same week, use the ticket IDs already listed there as a cross-check (don't skip tickets that appear there but not in git, e.g. design-only tickets).

### 3. Fetch ticket details

For each ticket ID, call the ticket tracker's fetch-by-ID tool. Extract: title, state, substate, resolution, resolver, milestone, classification, priority.

### 4. Find PRs per ticket

For each ticket ID:
```
git log --all --oneline --grep="<ticket-url-or-id>"
```
across all repos. Note PR numbers and merge dates.

### 5. Draft entries

For each ticket, produce a compact entry in this format (Slack / `weekly.txt` style):
```
  Ticket: #<id> — <title>
  Status: <Merged (repo PR #NNN, Month Day) | In Progress — <detail> | Design — <detail>>
  Details:
    <1 sentence, occasionally 2 if the ticket spans genuinely distinct pieces of work>
```

Details is a one-line summary of the outcome, not an implementation log. State what changed or what the root cause was — skip file/line references, method names, and step-by-step narration; that level of detail lives in the PR/commit, not the weekly report. Match the tone of a colleague's entry like "Added a fix to automatically expand the feedback section when a feature is added" — one clause, no sub-bullets, no multi-clause blow-by-blow.

Group entries under week header. Separate consecutive weeks with a divider line:
```
────────────────────────────────────────────────────────────────
```

### 6. Assemble Slack output

Full format:
```
  Week of <Mon Month D>–<Fri Month D>, <YYYY>

  Ticket: #<id> — <title>
  Status: ...
  Details:
    ...

  Ticket: #<id> — <title>
  ...
```

No emoji in the Slack output (weekly.txt). Emoji is for the team doc only.

### 7. Write weekly.txt

Prepend the new week block to the existing file — most recent week at the top. Do **not** delete prior weeks.

Path: `/Users/sladjan/Downloads/personal_docs/worklog/weekly.txt`

Read the current file first, then write: `<new week block>\n\n────...────\n\n<existing content>`.

### 8. Append to weekly JSON log

Path: `/Users/sladjan/Downloads/personal_docs/worklog/weekly_db.json`

If the file does not exist, create it as an empty JSON array `[]`.

Read the file, parse JSON, prepend a new entry (most recent first), write back:

```json
{
  "week_label": "Jun 2–6, 2026",
  "week_start": "2026-06-02",
  "week_end": "2026-06-06",
  "entries": [
    {
      "ticket_id": "178124143",
      "title": "...",
      "status": "merged",
      "prs": [{"repo": "backend-service", "number": 1753, "merged": "2026-05-29"}],
      "details": "..."
    }
  ]
}
```

Status values: `"merged"` | `"in_progress"` | `"design"` | `"blocked"`.

### 9. Emit to user

Print the full Slack-format block (same as what was written to `weekly.txt` for this week) so the user can copy it directly into Slack.

---

## Output

Emit the week block as plain text in a fenced code block. Then confirm the two files were written with their paths.
