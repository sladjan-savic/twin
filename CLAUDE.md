# widget review context

## 📚 Domain Context (Essential Knowledge) - widget review

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

**Key implication:** `allReferences` in `createBulkSamples` comes from the **the review service _search results**, not from direct DataStore reads of the dataset records table. Any ordering or grouping of records at sample creation time must be applied at the `_search` query level via `GroupRequestProto.SortParamProto`.

```scala
// Sort at the review service query level (correct approach)
GroupRequestProto(
  filter = ...,
  sort = SortParamProto(
    custom_sort = Seq("some_indexed_field asc")
  )
)
// → groups with the same field value come back adjacent
// → groupedPayloads naturally chunks them into same-value samples

// Post-fetch sort in the backend service (wrong approach)
// allReferences.sortBy(r => fetchSomeValueFromDB(r))
// → extra DB round trip, sort happens after the query boundary,
//   defeats the purpose of indexed search
```

---

## 🔑 Critical Implementation Details

### State Machine (Actual States)

```
CREATE (initial)
  ↓ EVENT_UPLOAD_DATA
DATA_LOADING (CSV processing)
  ↓ EVENT_DATA_READY
DATA_LOADED (ready for review)
  ↓ User action
IN_PROGRESS (active reviews)
  ↓ User action
FINISHED (complete)
  ↓ User action
CLOSED (archived)

Error path:
DATA_LOADING → DATA_LOAD_FAILED (EVENT_DATA_LOAD_ERROR)
```

### Key Endpoints (Actual from routes)

```scala
// the backend service endpoints
POST /api/1/evaluations/upload/:id
  → controllers.the controller class.uploadDatasetFile(id: String)

POST /api/1/evaluations/:id/process/_update
  → controllers.the controller class.updateProcessingStatus(id: String)

GET /api/1/evaluations/:id
  → controllers.the controller class.getEvaluation(id: String)

// the review service endpoints (called by the backend service)
POST /api/1.0/dataset/:evaluationId/_upload         // CSV ingestion
POST /api/1.0/automation-group/_search              // query groups for sampling
POST /api/1.0/automation-group/_start_review        // attach sample_id to groups
POST /api/1.0/automation-group/_end_review          // detach sample_id from groups
POST /api/1.0/automation-group/_apply_review        // push review feedback
GET  /api/1.0/dataset/records                       // fetch raw dataset records
```

### Data Model (Actual Structure)

```scala
// EvaluationInfo
case class EvaluationInfo(
  fsm_id: Option[String],
  assignmentGroupId: String,
  name: String,
  detection_type: Option[Seq[String]], // Contains "DATASET_EVALUATION"
  datasetInfo: Option[EvaluationDatasetInfo], // Dataset-specific metadata
  // ... other fields
)

// EvaluationDatasetInfo
case class EvaluationDatasetInfo(
  id: String,                                    // dataset_id (UUID)
  fileMetadata: Option[Seq[FileMetadata]],       // Upload history
  csvSchema: CSVSchemaProto,    // Column mappings
  survey: Option[QuestionnaireDataProto],            // Questionnaire
  removedQuestionIds: Option[Seq[String]],       // Deleted questions
  options: Option[EvaluationDatasetOptions]
)

// SampleInfo
case class SampleInfo(
  fsm_id: Option[String],
  evaluation_group_id: String,
  datasets: Option[Seq[EvaluationDatasetRecordInfo]], // Dataset records
  // ... other fields
)
```

### Core Services & Files

**the backend service Services:**
- `server/app/services/EvaluationService.scala`
  - `uploadDatasetFile()` - Main upload orchestration
  - `processDatasetEvaluationStatus()` - Handle callbacks
  - `createEvaluation()` - Creates evaluation with dataset_id
- `server/app/services/ReviewService.scala`
  - `uploadDatasetEvaluation()` - Calls ReviewServiceClient
- `server/app/services/GroupService.scala`
  - `createSamples()` - Entry point for sample creation (routed here for DATASET_EVALUATION)
  - Calls the review service `_search`, builds `ticketPayload.referenceInfos`, calls `RecordService.createBulkSamples`
- `server/app/services/RecordService.scala`
  - `createBulkSamples()` - Core chunking; `allReferences` comes from the review service search results
  - `createSamples()` - Routes to AG or Detection path based on `isAutomationGroupBased`
- `server/app/utils/EvaluationOps.scala`
  - `isAutomationGroupBased()` - Returns true for DATASET_EVALUATION (ByGroupField)
  - `isDatasetEvaluation()` - Type check used in upload/callback paths

**Controllers:**
- `server/app/controllers/the controller class.scala`
  - `uploadDatasetFile()` - Upload endpoint
  - `updateProcessingStatus()` - Callback endpoint

**Models:**
- `model/src/main/scala/com/the employer/geo/plasma/clients/the backend service/models/EvaluationInfo.scala`
- `model/src/main/scala/com/the employer/geo/plasma/clients/the backend service/models/EvaluationDatasetInfo.scala`
- `model/src/main/scala/com/the employer/geo/plasma/clients/the backend service/models/SampleInfo.scala`
- `server/app/models/DomainTypeField.scala`
  - `DATASET_EVALUATION extends ByGroupField` ← routing anchor

**GraphQL Schemas:**
- `server/app/graphql/schemas/CreateEvaluationInput.scala`
- `server/app/graphql/schemas/CreateDatasetEvaluationOptionsInput.scala`
  - Contains validation logic for widget reviews

**Constants:**
- `server/app/services/model/SharedConstants.scala`
  - `EVENT_UPLOAD_DATA`, `EVENT_DATA_READY`, `EVENT_DATA_LOAD_ERROR`
  - `STATE_DATA_LOADING`, `STATE_DATA_LOADED`, `STATE_DATA_LOAD_FAILED`

---

## 🧪 Validation Rules (Actual Implementation)

### CSV Schema Validation

**From CreateDatasetEvaluationOptionsInput.validate():**
```scala
1. Columns cannot be empty
2. Column numbers must be >= 0
3. Column numbers must be unique
4. Column types must be valid (POINT, METADATA, FEATURE_ID, etc.)
5. Column scopes: INPUT, INFERENCE, or null (defaults to INPUT)
```

### Questionnaire Validation

**From CreateDatasetEvaluationOptionsInput.validate():**
```scala
1. Survey must exist for widget reviews
2. At least one question required
3. Question prompt cannot be empty
4. Feedback types: BINARY_WITH_REASONS or MULTIPLE_CHOICE
```

### File Validation

**From FileUtils (used in the controller class):**
```scala
1. File size check (configuration-based limit)
2. Extension must be .csv
3. Filename: no spaces or special characters
```

---

## 🔄 Upload Flow (Actual Sequence)

```scala
// From EvaluationService.uploadDatasetFile()

1. getEvaluation(evaluationId)
   └─> Fetch EvaluationInfo from FSM

2. Validate evaluation is DATASET_EVALUATION type
   └─> Check detection_type contains "DATASET_EVALUATION"

3. patchFsm(evaluationId, EVENT_UPLOAD_DATA)
   └─> Transition: CREATE → DATA_LOADING

4. ReviewService.uploadDatasetEvaluation()
   └─> Extract csvSchema from evaluationInfo.datasetInfo
   └─> Call automationReviewServiceClient.uploadCsv()
   └─> Returns: FileStatusProto

5. processDatasetEvaluationStatus()
   └─> Match on status:
       - RUNNING: Update FileMetadata (EVENT_UPDATE)
       - DONE: Transition to DATA_LOADED (EVENT_DATA_READY)
       - ERROR: Transition to DATA_LOAD_FAILED (EVENT_DATA_LOAD_ERROR)

6. Return (fileStatus, updatedEvaluationInfo) to controller

// Later: the review service calls back
POST /api/1/evaluations/:id/process/_update
└─> processDatasetEvaluationStatus() again with final status
```

---

## 🎯 Callback Pattern (Critical!)

**the backend service uses CALLBACKS, not polling.**

```
the review service (review-service):
  1. Receives uploadCsv() call from the backend service
  2. Streams CSV via Pekko — writes automation_group + dataset_records rows in parallel
  3. Calls back to the backend service:
     POST /api/1/evaluations/:id/process/_update
     Body: FileStatusProto {
       datasetId,
       status: DONE | ERROR | RUNNING,
       fileLocation: { assetStoreReference },
       errorMessage?
     }

the backend service:
  4. Receives callback in updateProcessingStatus()
  5. Calls processDatasetEvaluationStatus()
  6. Updates EvaluationInfo and transitions FSM state
```

---

## 📋 Common Patterns in Codebase

### Pattern 1: FSM State Transitions

```scala
patchFsm(
  fsmId = evaluationId,
  fsmRevision = CommonInfo.EVALUATION_FSM_REVISION,
  eventType = CommonInfo.EVENT_UPLOAD_DATA,
  isDryRun = false
)(plasmaTicketClient, ioEC, rc)
```

### Pattern 2: Validation with Exceptions

```scala
if (condition_fails) {
  throw new StacklessBadRequestException(
    message = "Descriptive error message",
    vars = None
  )
}
```

### Pattern 3: IO Monad for Async Operations

```scala
for {
  evaluationInfo <- getEvaluation(evaluationId)
  _ <- validateSomething(evaluationInfo)
  result <- doAsyncOperation()
} yield result
```

### Pattern 4: Option Handling

```scala
// Safe unwrapping with exception
evaluationInfo.datasetInfo.getOrElse(
  throw new StacklessBadRequestException("Dataset info required", None)
)

// Safe extraction
val csvSchema = evaluationInfo.datasetInfo
  .map(datasetInfo => Json.toJson(datasetInfo.csvSchema).toString())
```

---

## 🐛 Common Pitfalls & Gotchas

1. **DATASET_EVALUATION is automation-group-based:** It extends `ByGroupField`, so `isAutomationGroupBased == true`. Sample creation routes through `GroupService` → the review service `_search`, not through a detection or direct DataStore path. Any assumption that widget reviews bypass the AG path is wrong.
2. **Sort and filter at the the review service search boundary, not after it:** `allReferences` in `createBulkSamples` is already the result of an the review service `_search` call. Post-fetch sorting in the backend service is the wrong layer. If records need to arrive in a specific order, the sort must go into `GroupRequestProto.SortParamProto` (or `custom_sort`), and the relevant field must be indexed in the automation group NS table — which is the review service's responsibility at ingestion time.
3. **Two NS tables, two purposes:** The automation group table drives search/sort/sample lifecycle. The dataset records table drives display and export. Do not conflate them. Reading dataset records to drive sample creation logic is a sign you're working in the wrong table.
4. **State Names Changed:** Documentation may say "WAITING_FOR_DATA" but code uses "DATA_LOADING"
5. **Callback, Not Polling:** No monitoring loop exists; rely on the review service callback
6. **dataset_id vs evaluation_id:** They're the same UUID in current implementation
7. **FileMetadata is a Seq:** Supports multiple upload attempts (track history)
8. **Validation happens in multiple places:** Controller (file), GraphQL schema (structure), Service (business rules)
9. **CSV Schema is Proto:** `CSVSchemaProto` (not JSON)
10. **Questionnaire is Proto:** `QuestionnaireDataProto` (not JSON)

---
## Shared contracts

`service-interfaces` (`/Users/sladjan/git/service-interfaces`) — protobuf definitions compiled via ScalaPB. Defines `GroupRecordProto`, `InsightsDataRecordProto`, and related types consumed by the review service and the backend service. Changes here require a version bump in downstream `build.sbt` files before they take effect.
