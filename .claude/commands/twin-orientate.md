Assess whether the current session's work warrants an orientation map update. Follow these steps exactly:

## Step 1 — Pre-flight

Call orientation_find with keywords derived from the current ticket's subdomain (2–4 terms, e.g. ["dataset", "evaluation", "sample"]).
Review the ranked results. If score ≥ 1 match exists, that is the candidate map.

Decide one of three outcomes:
- ENRICH: a ranked match covers this subdomain (new ticket pattern, correction)
- CREATE: no match — new subdomain with its own ticket shape
- DISCARD: no new navigation value — existing map already covers it accurately

State your decision and one-sentence justification. Stop and ask for confirmation before proceeding.

## Step 2 — Compose (on confirmation only)

If ENRICH: call orientation_load with the matched map's id to get full content. Compose the complete updated version in memory.
If CREATE: compose a complete new map in memory using the orientation template structure. Load the template via orientation_load with intent "TEMPLATE".

Rules:
- Section 5 (Ticket Patterns → Entry Points) is the product. Everything else is scaffolding.
- Ticket pattern headings must be problems a developer would report, not implementation descriptions.
- Verify every file path against the actual codebase before writing.
- Do not include the rules and scope guard section in the final output.
- Compose the complete file in memory before writing. No partial drafts.

## Step 3 — Save

Call orientation_save with:
- id: kebab-case slug of the domain (e.g. "dataset-groupby")
- domain: human-readable name (e.g. "Dataset GroupBy")
- keywords: array of match terms
- content: the complete composed markdown

Confirm: "Orientation map [id] saved ([enriched|created])."
