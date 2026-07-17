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

### 5. Write "Problem" and "Solution"

**Problem:** 1 sentence — the issue or goal (root cause for bugs; objective for tasks). Skip if the ticket title already says it clearly enough that repeating it would be pure padding.

**Solution:** 1–2 sentences — what changed and the outcome. Omit file/line references, method names, and step-by-step narration; that detail lives in the PR/commit. Mention how it was verified only if that's the single most important fact (e.g. hard-to-confirm regression), and note upstream unblocking radars only if the dependency itself is noteworthy.

Do not pad.

### 6. Emit the formatted the team doc block

```
<Category Label> <ticket title>

Ticket: ticket://<id> · PR: <repo> #<num> [+ <repo2> #<num2>] · Status: <emoji> <Merged/In Review/In Progress/etc> · State: <State>[/Substate]

Problem: <1 sentence>

Solution: <1–2 sentences>
```

Omit the PR field only if there truly are no commits. If multiple PRs, list all separated by ` + `.

---

## Output

Emit the block as plain text inside a fenced code block so the user can copy it cleanly. Do not add any commentary after the block.
