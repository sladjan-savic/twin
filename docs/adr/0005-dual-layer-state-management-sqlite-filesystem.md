# 5. Dual-Layer State Management (SQLite + Filesystem)

- **Status:** decided
- **Originally:** ADL-11 (twin's internal SQLite ADL store)
- **Tag:** #{POC-COGNITIVE-WORKFLOW-V1}
- **Type:** infra

---

## Context

### Rationale

SQLite is the primary coordination store (L1 cache for anchors, ADLs, orientation maps, test plans). All writes go to SQLite first. If SQLite write fails, state is written to storage/failover/ as a safety net. Filesystem (storage/) acts as durable backup, not primary. Postgres is the planned upgrade path when multi-process or multi-host coordination is needed.

## Decision

DB-first writes with FS failover

### Implementation

- **store_layer:** src/store/ (db.ts, anchors.ts, knowledge.ts)
- **invoker:** src/server.ts — thin MCP tool dispatcher, no business logic
- **failover_writes:** storage/failover/<tool>/<id>.json on SQLite error

### Core Capabilities

- SQLite as L1 coordination cache
- Filesystem as failover persistence
- store/ layer separates DB access from MCP tool surface
- Anchor hydration into working memory via anchor_load

## Consequences

### Risks

- Cache divergence if failover files accumulate without reconciliation
- Policy leakage into infra layer

### Note

Bridges conceptual kernel with real execution substrate. Failover files should be reconciled on startup.

## Additional Detail

### Storage Layers

- **L1_primary:** SQLite (storage/twin.db) — all reads and writes go here first
- **L2_failover:** storage/failover/ — written only on SQLite failure
- **upgrade_path:** Postgres — drop-in replacement when horizontal scale is needed
