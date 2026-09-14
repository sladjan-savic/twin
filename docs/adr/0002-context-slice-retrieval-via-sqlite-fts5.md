# 2. Context-Slice Retrieval via SQLite FTS5

- **Status:** proposed
- **Originally:** ADL-08 (twin's internal SQLite ADL store)
- **Tag:** #CONTEXT-SLICE-RETRIEVAL
- **Type:** architectural

---

## Context

Session initialisation currently frontloads context by loading individual stores
via blind substring-match queries (`LIKE '%intent%'`). Each store (anchors, ADLs,
orientation maps, policies, test plans) is queried separately with no ranking,
no cross-store surfacing, and no distinction between abstract (L0) and full
content (L1). This mirrors the class of problem seen in systems with limited
memory bandwidth: loading everything when only a relevant slice is needed.

The principle motivating this decision: **context is a managed resource, not a
dump.** A session should load the minimum relevant slice at start, then hydrate
deeper on confirmed need — analogous to lazy loading / hierarchical RAG at the
session design level.

---

## Decision

Add a unified FTS5 virtual table (`knowledge_fts`) as a shadow index over all
five knowledge store types. Expose it via a new `context_search` function and
MCP tool. Change session init to use `context_search(intent)` as its first
retrieval step, returning ranked L0 results before any full-content load.

**Retrieval mechanism:** SQLite FTS5 (built-in, zero new dependencies).  
BM25 ranking is provided natively via the `rank` column.

**Index shape:**
```sql
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
  item_id   UNINDEXED,
  item_type UNINDEXED,   -- anchor | adl | orientation | policy | test_plan
  title,
  abstract,              -- ~200 chars per item: resume+next / name+status / domain+keywords
  tags                   -- keywords / trigger_tags fields from each store
);
```

**Write path:** each existing `save*` function inserts/replaces the corresponding
row in `knowledge_fts`. No change to existing save signatures.

**Read path:**
```
context_search(query, limit=5)
  → SELECT item_id, item_type, title, abstract, rank
    FROM knowledge_fts WHERE knowledge_fts MATCH ? ORDER BY rank LIMIT ?
  → returns L0 only (no full content)

caller inspects item_type → calls appropriate _load for confirmed items only
```

**Session init change:** replace three separate blind loads with one
`context_search(intent)` call. Load full content only for the top anchor match
and any co-relevant items surfaced in L0.

---

## Alternatives considered

| Option | Rejected reason |
|---|---|
| Keep LIKE-based per-store queries | No ranking; cross-store surfacing requires N round trips; no L0/L1 separation |
| External vector DB (pgvector, Qdrant, Chroma) | Vendor dependency; overkill for corpus size (<200 items); embedding cost per write |
| Local embeddings (sentence-transformers) | Requires Python runtime or native module; adds infra complexity for marginal gain at this scale |
| BM25 implemented in TypeScript | Reimplements what SQLite already ships; maintenance burden |

---

## Consequences

**Positive:**
- Single `context_search` call replaces N per-store lookups at session start
- BM25 ranking surfaces best-match items, not just substring hits
- L0/L1 separation is now explicit: abstract in FTS, full content in source table
- No new dependencies; fits existing `node:sqlite` usage
- All existing `_load` / `_find` tools remain valid for direct lookup (additive change)

**Negative / watch:**
- FTS5 shadow table is a write-through cache — if a save fails partway, FTS index
  can diverge from source tables. Mitigated by existing `writeWithFailover` pattern;
  a periodic `context_reindex` tool should be added to recover from divergence.
- Abstracts must be curated at save time. Poor abstracts → poor retrieval.
  Convention: abstract = first 200 chars of the most human-readable field per type.

---

## Implementation scope

1. `db.ts` — migration v3: create `knowledge_fts`  
2. `knowledge.ts` — update all `save*` functions; add `contextSearch()`  
3. `server.ts` — register `context_search` MCP tool  
4. `0_session_init.md` — update step 2 to use `context_search` before `anchor_load`
