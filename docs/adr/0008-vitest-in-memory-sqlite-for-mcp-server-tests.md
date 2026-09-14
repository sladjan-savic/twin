# 8. Vitest + in-memory SQLite for MCP server tests

- **Status:** accepted
- **Originally:** ADL-14 (twin's internal SQLite ADL store)
- **Tag:** tests
- **Type:** tooling

---

## Context

The twin MCP server uses `node:sqlite`'s `DatabaseSync` (synchronous, built-in), initialized as a module-level singleton in `db.ts`. Store functions (`anchors.ts`, `policies.ts`, etc.) import the singleton directly.

Three test targets were identified:

1. **Zod schema validation** — pure unit tests, confirm defaults and required-field enforcement introduced in the schema-first refactor
2. **Anchor cascade logic** — the most complex behavior: completing a child seam pops itself from `parent.next`; closing an anchor recursively deletes non-completed descendants (ADL-13)
3. **Policy/orientation scoring** — the `findPolicies`/`findOrientations` tag-overlap scoring is non-trivial and was previously untested

---

## Decision

**Vitest** as the test framework — Anthropic's standard for TypeScript projects. Each test file runs in an isolated Vitest worker thread with its own module registry, giving each file a fresh DB singleton.

**`TWIN_DB_PATH=:memory:`** environment variable (added to `db.ts`) overrides the SQLite file path, directing each worker's `DatabaseSync` to an in-memory database. Combined with Vitest's per-file module isolation:

- Fresh, empty DB per test file (worker isolation)
- Fast test execution (no disk I/O)
- No pollution of the real `storage/twin.db`

**`TWIN_MEMORY_DIR=/tmp/twin-test`** redirects the failover directory away from `storage/failover/` during tests.

**`z.input<typeof Schema>`** in save function signatures — Zod's `.default()` creates a distinction between input type (field optional) and output type (field required after defaulting). Save functions accept the input type and parse internally, so callers (including tests) may omit defaulted fields (`depth`, `priority`, `tag`) and still receive correct behavior.

---

## What we test

| Suite | File | Coverage |
|---|---|---|
| Schema validation | `schemas.test.ts` | Defaults, required fields, invalid inputs — pure, no DB |
| Anchor cascades | `anchors.test.ts` | `parent.next` pop on child completion, last-sibling → `["integrate"]`, orphan tree deletion on close/abandon |
| Scoring algorithms | `scoring.test.ts` | Overlap ranking, priority tie-break, case-insensitivity, zero-overlap exclusion |
| Store round-trips | `roundtrips.test.ts` | Serialize → DB → deserialize for all five entity types |

---

## What we don't test

- **Trivial `loadX` SQL lookups** — single `WHERE + LIKE` query with no logic
- **MCP tool registration** — the SDK's responsibility
- **Failover write path** — would require `fs` mocking for marginal confidence gain
- **DB migrations** — idempotent `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE`; testing them adds coverage of SQLite internals, not our logic

---

## Alternatives considered

- **`node:test` built-in** — zero dependencies, but no watch mode, worse assertion DX, less alignment with Anthropic toolchain
- **Jest** — heavier ESM/TypeScript setup, no native `import.meta.url`, slower cold start
- **Dependency injection for `db`** — allows per-test DB instances without env vars, but requires restructuring all store function signatures; disproportionate for 840 lines of source

---

## Consequences

- New dev dependency: `vitest ^3.0.0`
- `db.ts` gains `TWIN_DB_PATH` env var alongside existing `TWIN_MEMORY_DIR`
- `tsconfig.json` excludes `__tests__/` from production build; Vitest has its own TypeScript pipeline
- Save functions accept `z.input<typeof Schema>` — defaults applied at store boundary, callers may omit defaulted fields
- `npm test` runs all suites; `npm run test:watch` for development
