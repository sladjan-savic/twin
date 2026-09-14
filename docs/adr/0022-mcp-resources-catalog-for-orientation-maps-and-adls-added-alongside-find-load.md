# 22. MCP Resources Catalog for Orientation Maps and ADLs — Added Alongside *_find/*_load

- **Status:** implemented
- **Originally:** ADL-28 (twin's internal SQLite ADL store)
- **Tag:** #MCP-RESOURCES-CATALOG
- **Type:** architectural

---

## Context

From the author's personal engineering backlog (not included in this repo; tracked against ADL-23's evaluation queue; cross-referenced against Claude Certified Architect guide Ch.4.5). ADL-23's evaluation method commits to checking each twin subsystem against native Anthropic/MCP mechanisms before assuming bespoke infrastructure is necessary. The orientation-map and ADL stores were named explicitly in ADL-23's own 'next' field as open. The guide's Ch.4.5 (resources reduce exploratory tool calls -- a resource provides an immediate map) is the first concrete native-mechanism candidate for that open evaluation.

## Decision

### Implementation

- **files_changed:**
  - mcp/src/store/orientations.ts -- added listOrientations() (id+domain for every row) and getOrientationById(id) (exact lookup, distinct from loadOrientation's fuzzy LIKE match used by the tool)
  - mcp/src/store/adls.ts -- added listAdls() (adl_id+name+status) and getAdlById(adl_id) (exact lookup)
  - mcp/src/server.ts -- two server.registerResource() calls using ResourceTemplate: twin://orientation/{id} and twin://adl/{id}
  - mcp/src/store/__tests__/roundtrips.test.ts -- added unit tests for the four new store functions
- **why_exact_lookup_not_fuzzy:** loadOrientation/loadAdl do a LIKE-based fuzzy match on intent text, appropriate for a tool call where the caller is guessing at a name. A resource's URI variable (filled in from resources/list's own uri field) is always an exact, known id -- fuzzy matching here would be the wrong semantics and could silently return the wrong record if two ids happen to be substrings of each other.
- **verification:** Build (tsc) clean. Existing 62-test suite passes unchanged; 4 new tests added and passing (66 total). Live protocol smoke test via @modelcontextprotocol/sdk Client + StdioClientTransport against the built dist/server.js: resources/list returned 26 real orientation-map entries and 24 real ADL entries from the live production twin.db; resources/read against a live orientation map and a live ADL both returned correct content; resources/read against a deliberately nonexistent ADL id correctly threw an MCP protocol error rather than silently succeeding.

## Consequences

### Evaluation

- **native_mechanism_identified:** MCP resources/list + resources/read, via the SDK's McpServer.registerResource with a ResourceTemplate (list callback + templated read callback). Confirmed available in the installed @modelcontextprotocol/sdk version (registerResource exists, non-deprecated).
- **does_bespoke_add_something_native_lacks:** Yes, for discovery-by-relevance: orientation_find/policy_find rank by keyword-overlap score against a query, and context_search does FTS5 ranked full-text search across all stores. MCP resources/list has no ranking or query parameter in the spec -- it returns the full catalog, unfiltered, for the client to browse. The two are complementary, not overlapping: resources/list answers 'what exists,' *_find/*_load/context_search answer 'what's relevant to this specific need.'
- **disposition:** ADD, don't replace. A resources/list catalog is added for orientation maps and ADLs. orientation_find, orientation_load, adl_load, and context_search are all retained unchanged -- this decision does not touch them.
- **scope_note:** The policy store and test-plan store were in scope for ADL-23's broader evaluation but are NOT addressed by this ADL -- only orientation maps and ADLs, matching this specific backlog item's request. Policies/test-plans remain open for a future evaluation instance.

### Non-Goals

- Replacing orientation_find/orientation_load/adl_load/context_search -- explicitly retained, see disposition above.
- Extending the resources catalog to policies or test plans in this ADL -- future evaluation instance, if pursued.
- Adding resources/subscribe (live-update notifications) -- MCP supports this but nothing in the backlog item or the underlying need calls for it; twin's stores don't change fast enough within a session to justify subscription overhead.

### Risks

- **id:** R1
- **note:** resources/list returns the FULL catalog unfiltered (26+24 entries today, growing). No pagination implemented. Not a problem at current scale; would need addressing if either store grows to hundreds of entries and a client chokes on payload size.
- **id:** R2
- **note:** Two lookup paths per store (fuzzy via *_load, exact via the new get*ById) must both be kept correct if the underlying table schema changes. Mitigation: both read from the same table with a trivial single-column WHERE/LIKE query each -- low surface area for drift.

### Next Steps

No further action required for orientation maps/ADLs. If policies or test plans are evaluated against this same native mechanism later, follow this ADL's pattern (list()+getById() in the store, registerResource+ResourceTemplate in server.ts) rather than re-deriving the approach.
