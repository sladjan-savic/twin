# Weekly Report

Generate the full weekly work summary: Slack-format text, write to `weekly.txt`, append to the weekly JSON log.

---

## Input

- Week date range: accept as argument (e.g. `Jun 2–6`) or default to the current calendar week (Monday–Friday).
- If the week is not the current week, confirm before proceeding.

---

## Steps

### 1. Determine the week

Compute Monday and Friday dates for the target week. Format: `Month D–D, YYYY`.

### 2. Gather ticket IDs worked this week

Search git log across all repos for commits in the date range:
```
git log --after="YYYY-MM-DD" --before="YYYY-MM-DD" --oneline --all
```
Run in each of:
- `/Users/sladjan/git/backend-service-a`
- `/Users/sladjan/git/review-service`
- `/Users/sladjan/git/service-interfaces`
- `/Users/sladjan/git/data-schema`

Extract all `ticket://NNNNNNNN` references from commit messages. Deduplicate.

Also check `/Users/sladjan/Downloads/personal_docs/worklog/weekly.txt` — if the existing file covers the same week, use the ticket IDs already listed there as a cross-check (don't skip radars that appear there but not in git, e.g. design-only tickets).

### 3. Fetch ticket details

For each ticket ID, call `getProblemByIds`. Extract: title, state, substate, resolution, resolver, milestone, classification, priority.

### 4. Find PRs per ticket

For each ticket ID:
```
git log --all --oneline --grep="ticket://<id>"
```
across all repos. Note PR numbers and merge dates.

### 5. Draft entries

For each ticket, produce a compact entry in this format (Slack / `weekly.txt` style):
```
  Ticket: #<id> — <title>
  Status: <Merged (repo PR #NNN, Month Day) | In Progress — <detail> | Design — <detail>>
  Details:
    <2–4 sentences: what was done, what changed, any key file/line references>
```

Keep entries factual and dense — no padding. Reference file paths only when they anchor something non-obvious.

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
      "radar_id": "178124143",
      "title": "...",
      "status": "merged",
      "prs": [{"repo": "backend-service-a", "number": 1753, "merged": "2026-05-29"}],
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
