# widget review context

## 📚 Domain Context

### What is Widget Reviews?

A **review-only evaluation system** for data quality assessment **without automation pipelines**. Enables teams to:
- Upload CSV files with arbitrary datasets
- Define custom questionnaires for review
- Evaluate ML model inferences
- Assess map quality in new markets
- Compare multiple ML models side-by-side

**Key Innovation:** Decouples data review from complex automation pipeline infrastructure.

### Core Workflow

```
1. User creates Widget Review
   └─> Configures CSV schema (column mappings)
   └─> Configures Questionnaire (custom questions)

2. User uploads CSV file
   └─> the backend service validates & transitions to DATA_LOADING
   └─> Calls ReviewService to process CSV
   └─> the review service streams CSV → writes TWO NS tables per row:
         automation_group table (GroupRecordProto)
         dataset_records table (InsightsDataRecordProto)

3. the review service calls back to the backend service
   └─> POST /api/1/evaluations/:id/process/_update
   └─> Status: DONE → DATA_LOADED (ready for review)

4. Reviewers request samples
   └─> the backend service routes through GroupService (AG-based path)
   └─> GroupService calls the review service _search to get automation groups
   └─> allReferences = the review service search results (ticketPayload.referenceInfos)
   └─> groupedPayloads chunks allReferences into per-sample sets
   └─> Samples created in FSM with dataset references

5. Reviewers provide feedback
   └─> Answer questions per inference
   └─> Submit samples

6. Export results
   └─> Merge feedback with original CSV
   └─> Download enriched dataset
```

### Key Concepts

**Input vs Inference:**
- **Input:** Source data (e.g., POI location, image URL)
- **Inference:** Model predictions (e.g., hook point with confidence score)

**CSV Schema:**
- Maps CSV columns to known types (POINT, METADATA, FEATURE_ID, etc.)
- Defines column scope (INPUT or INFERENCE)
- Enforces ordering: METADATA before LOCATION columns

**Questionnaire:**
- Custom questions per evaluation
- Feedback types: BINARY_WITH_REASONS or MULTIPLE_CHOICE
- Reviewers answer questions per inference

**dataset_id:**
- UUID grouping all the data store records for an evaluation
- Used for filtering automation groups
- Generated during evaluation creation

---

## 🏗️ Architecture (the backend service Perspective)

### the backend service Role: Orchestrator & Validator

**What the backend service DOES:**
- Receives client requests (the client app via GraphQL/REST)
- Validates CSV schemas and questionnaires
- Orchestrates CSV upload to ReviewService
- Manages evaluation state transitions (FSM)
- Handles callbacks from the review service
- Routes sample creation through GroupService → the review service _search
- Chunks sorted automation group references into per-sample payloads
- Provides query/mutation APIs for the client app

**What the backend service DOES NOT do:**
- CSV parsing (the review service)
- File storage (NSS Asset Store)
- the data store record creation (the review service)
- Indexing of NS table fields (the review service owns both NS tables)
- Sort logic at the data layer — sort belongs in the the review service _search query, not post-fetch in the backend service
- UI rendering (the client app)

### Integration Points

```
the client app (Client)
    ↓ GraphQL/REST
the backend service (Backend)
    ├──> ReviewServiceClient
    │     └─> Upload: POST /api/1.0/dataset/:id/_upload (CSV + schema)
    │     └─> Callback: receives FileStatusProto
    │     └─> _search: query automation groups (sort, filter)
    │     └─> _start_review / _end_review: attach/detach sample_id from groups
    │     └─> _apply_review: push review feedback back to the review service
    ├──> NSS Asset Store
    │     └─> CSV upload/download
    └──> the data store
          └─> Read dataset records (InsightsDataRecordProto)
          └─> Store evaluation/sample metadata (FSM)
```

---

## 🗄️ the review service Dual-Table Write Pattern (Critical!)

During CSV ingestion, the review service writes **two NS records per CSV row** in parallel via a Pekko Streams graph:

```
CSV row
  ├──> GroupRecordProto       → saved to agTableName (automation_group table)
  │     └─> group_key.automation_name = DATASET_EVALUATION
  │     └─> member_reference pointing to the dataset record
  │     └─> attributes (key-value pairs from CSV columns)
  │     └─> review_info (sample_id lifecycle managed here)
  │
  └──> InsightsDataRecordProto  → saved to dsTableName (dataset_records table)
        └─> inputs (INPUT-scoped columns: METADATA, LOCATION_*, etc.)
        └─> inferences (INFERENCE-scoped columns)
        └─> referenceMetadata (source asset info)
```

**Why this matters for any feature touching sample creation or search:**
- The **automation group table** is the surface the review service exposes for search, sort, and sample lifecycle
- The **dataset records table** is the raw data store; the backend service reads it for display/export, not for driving sample creation
- Any field that needs to be **sortable or filterable at sample creation time** must be indexed on the automation group record — indexing is the review service's responsibility at ingestion time
- the backend service queries the automation group table via `_search`; the dataset records table via direct DataStore reads

---

## 🔍 Sample Creation Path (Actual)

**DATASET_EVALUATION is automation-group-based, not detection-based.**

```scala
// DomainTypeField.scala
final case object DATASET_EVALUATION extends ByGroupField
  // automationCategory = AutomationCategory.AUTOMATION_GROUP
  // automationMemberCategories = Seq(AutomationCategory.DATASET)
  // defaultClient = AutomationClientType.AUTOMATION_REVIEW_SERVICE
```

This single fact determines the entire sample creation routing:

```
createBulkSamples (GraphQL Mutation)
  └─> RecordService.createSamples
        └─> isAutomationGroupBased(evaluationInfo) == TRUE  ← because ByGroupField
              └─> GroupService.createSamples
                    └─> the review service _search  ← automation groups fetched here, with sort/filter
                          └─> ticketPayload.referenceInfos
                                └─> allReferences in createBulkSamples
                                      └─> groupedPayloads → chunk into samples
```

**Key implication:** `allReferences` in `createBulkSamples` comes from the **the review service _search results**, not from direct DataStore reads. Any ordering at sample creation time must be applied at the `_search` query level via `GroupRequestProto.SortParamProto`.

```scala
// Sort at the review service query level (correct approach)
GroupRequestProto(
  filter = ...,
  sort = SortParamProto(custom_sort = Seq("some_indexed_field asc"))
)
// Post-fetch sort in the backend service = wrong layer
```

---

## 🐛 Common Pitfalls & Gotchas

1. **DATASET_EVALUATION is automation-group-based:** extends `ByGroupField` → `isAutomationGroupBased == true`. Sample creation routes through `GroupService` → the review service `_search`, never through a detection or direct DataStore path.
2. **Sort and filter at the the review service search boundary, not after it:** post-fetch sorting in the backend service is the wrong layer. Sort goes into `GroupRequestProto.SortParamProto`; the field must be indexed in the automation group NS table (the review service's responsibility at ingestion).
3. **Two NS tables, two purposes:** automation group table drives search/sort/sample lifecycle; dataset records table drives display and export. Reading dataset records to drive sample creation = wrong table.
4. **State Names Changed:** docs may say "WAITING_FOR_DATA" but code uses "DATA_LOADING"
5. **Callback, Not Polling:** no monitoring loop; rely on the review service callback
6. **dataset_id vs evaluation_id:** same UUID in current implementation
7. **FileMetadata is a Seq:** supports multiple upload attempts
8. **Validation happens in multiple places:** Controller (file), GraphQL schema (structure), Service (business rules)
9. **CSV Schema is Proto:** `CSVSchemaProto` (not JSON)
10. **Questionnaire is Proto:** `QuestionnaireDataProto` (not JSON)

---

## Shared contracts

`service-interfaces` (`/Users/sladjan/git/service-interfaces`) — protobuf definitions compiled via ScalaPB. Defines `GroupRecordProto`, `InsightsDataRecordProto`, and related types consumed by the review service and the backend service. Changes here require a version bump in downstream `build.sbt` files before they take effect.
