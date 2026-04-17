Assess whether the current session's work warrants an orientation map update. Follow these steps exactly:

## Step 1 — Pre-flight

Read all existing files in /Users/sladjan/git/twin/orientation/ (filenames only, not content).
Compare the current ticket's subdomain and scope against them.

Decide one of three outcomes:
- ENRICH: work fits inside an existing doc (sub-feature, new ticket pattern, correction)
- CREATE: cross-cutting concern with its own ticket shape, no existing doc covers it
- DISCARD: no new navigation value — existing docs already cover it accurately

State your decision and one-sentence justification. Stop and ask for confirmation before proceeding.

## Step 2 — Compose (on confirmation only)

If ENRICH: read the full target file into memory. Compose the complete updated version in memory. Do not produce intermediate states.
If CREATE: compose a complete new file in memory using /Users/sladjan/git/twin/orientation/TEMPLATE — Developer Orientation Map.md as the structure. Do not reference the template in the output.

Rules:
- Section 5 (Ticket Patterns → Entry Points) is the product. Everything else is scaffolding.
- Ticket pattern headings must be written as problems a developer would report, not as implementation descriptions.
- Verify every file path against the actual codebase before writing it.
- Delete the rules and scope guard section before writing the final file.
- One atomic file_write. No partial edits.

## Step 3 — Write

Write the complete composed file in a single operation to /Users/sladjan/git/twin/orientation/.
Confirm the filename and action taken (enriched / created / discarded).
