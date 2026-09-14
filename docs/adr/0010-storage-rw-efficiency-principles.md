# 10. Storage RW Efficiency Principles

- **Status:** standing
- **Originally:** ADL-16 (twin's internal SQLite ADL store)
- **Tag:** #{POC-COGNITIVE-WORKFLOW-V1}
- **Type:** principle

---

## Context

### Applies To

Any storage layer — SQLite now, Postgres later, or any future migration target

## Decision

### Principles

- **broad_reads:**
  - **rule:** One broad query + in-process ranking/filtering beats N directed queries.
  - **anti_pattern:** Calling a directed read per record (e.g. orientation_load for every result of orientation_find).
  - **implementation:** Fetch the full candidate set in one SELECT, rank or filter in application code.
- **batch_writes:**
  - **rule:** Multiple related writes must run in a single transaction, not sequentially.
  - **anti_pattern:** Three saveX() calls in a row — three round-trips, no atomicity.
  - **implementation:** writeBatchWithFailover(ops[]) wraps all writes in BEGIN/COMMIT; rolls back and failovers as a unit on error.

### Migration Contract

Any replacement for the SQLite layer must expose equivalents for both patterns: a bulk-fetch query surface and a batch-write/transaction primitive. If the new store cannot support one of these, it must be flagged as a regression before migration proceeds.

### Enforcement

- **reads:** orientation_find (and any future *_find tool) fetches all candidates in one query.
- **writes:** writeBatchWithFailover in store/db.ts — use whenever saving 2+ related records.

## Consequences

Not recorded.
