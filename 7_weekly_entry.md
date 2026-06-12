# Weekly Entry — Single Ticket (the team doc format)

Generate a formatted the team doc entry for one ticket ticket, ready to paste into the week's section.

---

## Input

The ticket ID comes from one of:
- The argument passed to the skill (e.g. `/weekly-entry ticket://178124143`)
- The current session's anchor/context (ask if ambiguous)

---

## Steps

### 1. Fetch ticket details

Call `getProblemByIds` with the ticket ID. Extract:
- Title
- State and substate
- Classification (Bug / Task / Feature / etc.)
- Priority (P1–P4)
- Milestone (Release NNN)
- Resolution and resolver (if resolved)
- Any recent state change events with dates

### 2. Find related PRs

Search git log across all working directories for commits referencing the ticket ID. Use:
```
git log --all --oneline --grep="ticket://<id>"
```
Run this in each repo that may be relevant:
- `/Users/sladjan/git/backend-service-a`
- `/Users/sladjan/git/review-service`
- `/Users/sladjan/git/service-interfaces`
- `/Users/sladjan/git/data-schema`

Extract PR numbers from commit messages (pattern: `#NNNN`). Note merge dates.

### 3. Determine status emoji

| Condition | Emoji |
|---|---|
| Ticket resolved + PR merged | ✅ |
| In progress, blocked | 🔴 |
| In progress, not blocked | 🟡 |
| Design / exploration only, no code | 🔴 (use if blocked on external input) or 🟡 |

### 4. Determine category

Map ticket title / component to the nearest section header used in the weekly the team doc. Common ones:
- `🗂️ widget reviews`
- `📱 App Reviews`
- `🤖 Automation`
- `🗺️ Maps / Geospatial`

Use judgment; new categories are fine if they fit better.

### 5. Write "What was done"

3–6 sentences, engineering-focused:
- What the bug or task was (root cause for bugs; goal for tasks)
- What specifically was changed — include `File.scala:line` references where they anchor the explanation
- How it was confirmed / verified (the-signal-source, tests, the observability tool, etc.) if mentioned in commits or ticket

Do not pad. Do not summarise what the ticket title already says.

### 6. Emit the formatted the team doc block

```
**✅ [Category Label] <ticket title>**

**Ticket:** ticket://<id>
**PR:** <repo> #<num> [+ <repo2> #<num2>] — Merged <Month Day>   (or: PR: None — <reason>)
**Ticket state:** <State> [› Substate: <Substate>] [(<event note>)]
**Classification:** <Classification> · Priority <N> · Milestone: <Milestone>

**What was done:**
<narrative>
```

Omit the PR line only if there truly are no commits. If multiple PRs, list all on one line separated by ` + `.

---

## Output

Emit the block as plain text inside a fenced code block so the user can copy it cleanly. Do not add any commentary after the block.
