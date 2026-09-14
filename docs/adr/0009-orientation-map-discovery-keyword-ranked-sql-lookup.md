# 9. Orientation Map Discovery: Keyword-Ranked SQL Lookup

- **Status:** decided
- **Originally:** ADL-15 (twin's internal SQLite ADL store)
- **Tag:** #{POC-COGNITIVE-WORKFLOW-V1}
- **Type:** infra

---

## Context

### Problem

orientation_load requires knowing the domain name or a close keyword match. With multiple maps, finding the right one requires probing one-by-one — O(n) and fragile.

### Rationale

Corpus is small, keywords already exist in SQLite, ranked SQL query gives pattern matching without adding dependencies. Semantic/vector search deferred until keyword overlap produces false ties at scale.

## Decision

Add a findOrientations(tags[]) query that returns ranked matches by keyword overlap. Keywords are already stored per map; no new infrastructure needed.

### Interface

- **new_tool:** orientation_find
- **input:** tags: string[] — intent keywords
- **output:** ranked list of orientation maps (id, domain, keywords, overlap_score)

### Implementation

- **store:** mcp/src/store/knowledge.ts — findOrientations(tags: string[])
- **pattern:** One broad SELECT of all maps, rank by keyword overlap in TS

## Consequences

### Deferred

Semantic/vector search (sqlite-vec or similar) — revisit when keyword overlap produces false ties at scale

### Risks

- Keyword quality depends on map authors — garbage in, garbage out
- No disambiguation if two maps have identical keyword overlap score
