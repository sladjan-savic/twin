# Test plan generation

MODE: Test planning

## Task context

- Ticket / ticket from current session anchor
- Git diff or description of what changed
- Target environment (staging, production, local)

## Steps

1. **Read the methodology** — load `test_plans/_how-to-write-a-test-plan.md`. This is the process to follow.

2. **Understand the change** — read the diff or ask the user to describe what changed. For each changed unit identify: what it does, its inputs, its expected output, and null/edge cases.

3. **Map entry points** — trace each changed unit to its surface (GraphQL query path, REST endpoint, Kafka event). Write the path explicitly. If you cannot determine the path from the diff alone, explore the codebase.

4. **Identify data requirements** — for each test, state what entity state or prior workflow activity makes the field/behaviour non-trivial. Note what is likely to be absent in staging.

5. **Write a discovery query / request** — provide the simplest listing call that returns usable entity IDs. Look for signals in the response that indicate the right entity to test against.

6. **Write the tests** — one test per changed unit (or per logical group sharing an entry point). Each test must have: path, requires, query/request, pass criterion, edge cases.

7. **Build the data availability matrix** — after tests are written, fill the table honestly.

8. **Save the plan** — write to `test_plans/ticket-<ID>-<slug>.md`. Use the ticket ID and a short kebab-case description of the change as the filename.

## Output format

A complete test plan document matching the structure in `test_plans/_template-graphql-schema-fields.md`, adapted to the actual surface being tested (GraphQL, REST, or other).

Sections:
- Scope (one paragraph)
- Notes (caveats, edge cases validated, unicode/null safety)
- Discovery query
- T1…Tn (one per changed unit)
- Data availability matrix

## Lifecycle

On completing this stage:
1. Save the file to `test_plans/ticket-<ID>-<slug>.md`
2. Emit `[STAGE_COMPLETE | stage=TEST_PLAN | file=<path> | tests=<count>]`
3. Offer: "Update the anchor with test plan path?"
4. On confirm → call anchor_save with updated state referencing the test plan file.
