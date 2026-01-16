# Graphonomous Execution Model

This document defines **how Graphonomous runs behave**—especially ingestion (writes), search (reads), idempotency/dedupe, directive boundaries, and provenance/citation requirements.

It is designed to align with portfolio standards:

- Signals are immutable facts; directives are controlled intent.
- Side effects require explicit intent boundaries.
- No secrets in durable artifacts (signals, directives, logs, stored docs/metadata).
- Canonical tool identifiers are namespaced as `<agent_id>/<tool_name>` (Core-routed).

Related specs:
- `Project[&]/graphonomous.com/project_spec/INTERFACES.md`
- `Project[&]/graphonomous.com/project_spec/SECURITY.md`
- `Project[&]/graphonomous.com/project_spec/PERMISSIONS.md`
- `Project[&]/project_spec/standards/signals-and-directives.md`
- `Project[&]/project_spec/standards/tool-calling-and-execution.md`

---

## 0) Two execution classes: reads vs writes

### 0.1 Read executions (search)
Read executions include:
- `com.graphonomous.core/graph_search`
- `com.graphonomous.core/graph_list_collections`

Properties:
- should be safe to run directly as tools (permission-checked, auditable)
- must not mutate durable state
- must return citations/provenance

### 0.2 Write executions (ingestion and mutations)
Write executions include:
- `com.graphonomous.core/graph_ingest`
- any future tools that create/update/delete collections/entities/relationships

Properties:
- side-effectful
- must be explicitly permissioned (`graph:write:<collection>`)
- should be directive-backed when initiated from chat/tool-calling flows
- must be idempotent and replay-safe

---

## 1) Execution records (durable)

Graphonomous must produce durable execution records for operations that matter operationally or security-wise.

### 1.1 Ingestion execution record (required)
Each ingestion produces an **ingestion execution record** with (minimum):

- `ingest_id` (string): Graphonomous-assigned stable id
- `collection` (string)
- `requested_at`, `started_at`, `finished_at` (RFC3339 timestamps)
- `status`: `accepted | running | succeeded | failed | canceled | deduped`
- `actor` (string): caller identity (agent id / human id, if available)
- `inputs_summary` (object): secret-free summary (never full secrets; avoid full raw content if it may contain sensitive data)
  - include: `content_bytes`, `metadata_keys`, `source_type`, `source_ref` (if safe), `dedupe_key` (if provided)
- `outputs_summary` (object): secret-free summary
  - include: `document_id`, `content_hash`, `chunk_count`, `entity_count`, `relationship_count`
- `correlation_id` (string, optional but recommended)
- `causation_id` (string, optional)
- `error` (object, optional): structured, secret-free error (if failed)

Storage location is an implementation decision, but must be queryable/mergeable into the Core audit timeline.

### 1.2 Search execution record (recommended)
Searches are read-only but can still benefit from durable records for audit and debugging.

Minimum recommended fields:

- `query_id` (string)
- `requested_at`, `finished_at`
- `status`: `succeeded | failed | canceled`
- `collections` (list of strings)
- `query_fingerprint` (string): hash of query text (do not persist raw query by default)
- `result_count`
- `correlation_id` / `causation_id`
- `error` (if failed)

---

## 2) Directive boundary model (writes)

### 2.1 Normative rule
When Graphonomous is invoked from a model-driven tool-calling context (chat UI, automated agent reasoning loop), **write operations must be directive-backed**.

This preserves the portfolio invariant:
- “model output does not directly cause durable mutations without explicit intent.”

### 2.2 Two acceptable implementations (pick one for MVP, document it in code)
Graphonomous can satisfy the directive boundary in either of these ways:

**Mode A — Core-owned directive boundary (recommended for portfolio consistency)**
- Core treats certain tool calls as “mutating” and wraps them in a directive lifecycle.
- Graphonomous receives an already-authorized invocation and performs the write.
- Core audit log remains authoritative for “intent”, and Graphonomous emits “facts” (signals) about outcomes.

**Mode B — Agent-requested directives**
- `com.graphonomous.core/graph_ingest` does not perform the write directly in chat contexts.
- Instead, Graphonomous requests a directive (e.g., `graphonomous.ingest.perform`) and returns `{ directive_id, status }`.
- A directive runner (Core or Graphonomous runner, per portfolio architecture) performs the write and emits signals.

Both are compatible with the portfolio model; Mode A is simpler because Core is already the marketplace/audit authority.

### 2.3 Run-time permission re-check (required)
Regardless of Mode A or B:
- permission checks must occur at request time, and again at execution time (TOCTOU safety).
- if permissions were revoked after the directive/tool call was created, the write must be denied at run time and recorded as such.

---

## 3) Ingestion idempotency and dedupe

Ingestion must be replay-safe. The system must converge to a single canonical stored document/embedding/graph state for the same logical document.

### 3.1 Required primitives
Graphonomous must compute and/or accept stable identifiers:

- `dedupe_key` (string, optional input but strongly recommended)
- `content_hash` (string, computed): stable hash of the persisted (post-sanitization) content
- `document_id` (string, assigned): stable id for stored document

### 3.2 Dedupe key rules (recommended)
Preferred dedupe hierarchy (highest to lowest):
1. If caller provides `dedupe_key`, use it.
2. Else, compute dedupe key from persist-safe provenance if available:
   - `dedupe_key = sha256(collection + "|" + source_type + "|" + source_ref + "|" + content_hash)`
3. Else fallback:
   - `dedupe_key = sha256(collection + "|" + content_hash)`

Important:
- dedupe must be scoped at least by `collection`
- dedupe decision must be atomic under concurrency (unique constraint or transactional compare-and-set)
- dedupe must be recorded (audit-visible) as either `status = deduped` or an explicit dedupe marker

### 3.3 What “deduped” means (normative)
If an ingest request dedupes, Graphonomous must:
- not create a second copy of stored content
- not create duplicate embeddings/chunks/entities/edges for that same canonical doc version
- return a stable reference to the canonical record (existing `document_id` and `ingest_id` or a new `ingest_id` with `status=deduped`)

### 3.4 Update semantics (explicit)
There are two acceptable update models—choose one and keep it consistent:

**Model 1 — Immutable versions (recommended)**
- If the same `dedupe_key` is used with different content_hash, reject as conflict (`graph.dedupe_conflict`), or treat as “new version” explicitly:
  - `document_id` remains stable
  - new `document_version_id` is created
  - old versions remain available for audit within retention constraints

**Model 2 — Update-in-place (simpler but riskier)**
- If content changes, overwrite stored content and reindex.
- Must still preserve audit continuity:
  - keep old `content_hash` history and timestamps
  - store a prior_version pointer or an append-only change log

Portfolio-leaning recommendation: Model 1 (immutable versions) because it aligns with “signals are facts” and replayability.

### 3.5 Concurrency guarantees (required)
Concurrent ingestion of the same `dedupe_key` must be safe:
- exactly one canonical document record is created
- other calls return `deduped` (or “already exists”) with the same canonical identifiers
- partial writes must either complete or roll back deterministically on retry

---

## 4) Ingestion pipeline and status model

### 4.1 Ingestion stages (conceptual)
An ingestion run may include these stages:

1. Validate input schema and permissions
2. Sanitize (redact/reject secrets; normalize metadata)
3. Normalize content (UTF-8, line endings, etc.)
4. Compute fingerprints (`content_hash`, `dedupe_key`)
5. Persist document record (durable, secret-free)
6. Chunk content deterministically
7. Generate embeddings (local or remote provider)
8. Extract entities/relationships (graph mode; optional in MVP)
9. Persist derived artifacts (chunks, embeddings, entities, edges)
10. Emit signals for `accepted`, `succeeded`, `failed`

### 4.2 Status transitions (normative)
Allowed status transitions:

- `accepted -> running -> succeeded`
- `accepted -> running -> failed`
- `accepted -> running -> canceled`
- `accepted -> deduped` (may skip running)
- `running -> failed` (terminal)
- `running -> canceled` (terminal)

Terminal states:
- `succeeded | failed | canceled | deduped`

Once terminal, ingestion is immutable; reprocessing requires a new run (or a new document version, if using immutable versions).

### 4.3 Cancellation
Long-running ingestion should be cancelable (best-effort):
- cancellation should stop future work (embedding/entity extraction)
- must record a terminal `canceled` state
- must not leave durable artifacts without a corresponding terminal record
- if partial artifacts exist, the system must define a cleanup/compaction path (either immediate rollback or a background GC directive/job)

---

## 5) Search execution semantics

### 5.1 Query execution
Search must:
- validate requested collections (non-empty, known, within tenant scope)
- enforce `graph:read:<collection>` for each collection
- execute retrieval:
  - vector search and optional graph expansion (Arcana-backed)
- return bounded results with citations

### 5.2 Result stability vs ranking
Ranking may change as new data is ingested. However:
- provenance identifiers must remain stable (document_id, content_hash)
- citations must remain valid references to stored sources
- if a document is deleted/expired, queries should not return dangling citations (or must clearly indicate tombstoned sources)

### 5.3 Query logging (secret-safe)
User queries may contain secrets.
Default logging should store only:
- query hash/fingerprint
- collections requested
- timing and result counts
- correlation_id/actor

Do not persist raw query text by default.

---

## 6) Citation and provenance requirements (normative)

Graphonomous outputs must be explainable. Every search result must include citations/provenance sufficient for a human operator to verify.

### 6.1 Required citation fields (minimum viable)
Each result must include at least one citation object with:

- `document_id` (string)
- `collection` (string)
- `source_type` (enum): `repo_file | url | note | integration | unknown`
- `source_ref` (string, optional but recommended): safe reference to the origin (no secrets)
- `content_hash` (string, recommended): hash of persisted (post-sanitization) content
- `excerpt` or `quote` (string, optional): bounded, secret-free snippet
- `location` (optional but recommended): one of:
  - `{ start_offset, end_offset }` (character offsets in the stored content representation), or
  - `{ line_start, line_end }` (for line-oriented sources)
- `ingested_at` (timestamp, optional but recommended)

### 6.2 Stability and integrity
Citations must be stable across:
- agent restarts
- reindexing / rebuilding embeddings
- schema migrations

To achieve this, Graphonomous should:
- use stable `document_id` derived from dedupe key or explicit external id
- store and return `content_hash`
- ensure offsets refer to the stored content representation (post-sanitization)

### 6.3 Redaction impact on citations (required)
If Graphonomous redacts content before persistence:
- citations must reference the redacted content (not the pre-redaction source bytes)
- offsets/spans must align with the redacted representation
- excerpts must never include redacted secret material

### 6.4 Graph-derived claims still require document provenance
If Graphonomous returns entities/relationships inferred via graph extraction:
- each entity/relationship returned must be attributable to one or more source documents (citations list)
- do not emit “citation-less facts” as tool output unless explicitly marked as ungrounded and safe

---

## 7) Retention, deletion, and replay hooks

### 7.1 Retention
Collections may define `retention_days` (repo-local `.fleetprompt/graphonomous/collections.json`).

Retention must consider:
- raw content retention
- derived embeddings retention
- derived graph artifacts retention

If content is expired/deleted:
- either remove derived artifacts, or mark them tombstoned
- ensure search does not return stale references
- preserve minimal audit-safe metadata (ids, timestamps, hashes) where feasible to maintain timeline integrity

### 7.2 Deletion (side effect, directive-backed)
Deletion operations must be:
- explicit directives
- permissioned (write/admin scope)
- auditable
- idempotent (delete-by-id can be repeated safely)

### 7.3 Replay / reindex
Reindexing (re-embedding, re-extracting entities) is a side effect and should be:
- initiated as a directive/job
- bounded and rate-limited
- auditable with correlation links
- safe: must not change document identity or provenance fields, only derived artifacts

---

## 8) Error handling and guarantees

### 8.1 Structured errors (required)
Errors must be structured and secret-free. Prefer stable error codes such as:
- `graph.permission_denied`
- `graph.collection_not_found`
- `graph.payload_rejected` (secret detected / invalid input)
- `graph.dedupe_conflict`
- `graph.backend_unavailable`
- `graph.internal_error`

### 8.2 Partial failure behavior (ingestion)
If ingestion fails after the document record is persisted but before derived artifacts are complete:
- record terminal `failed` state with sanitized error
- define whether subsequent retries:
  - resume and complete (recommended), or
  - roll back and restart (acceptable if deterministic)

In either case, retries must not create duplicates.

---

## 9) MVP recommendations (to reduce ambiguity)
For MVP implementation, the least risky and most portfolio-aligned defaults are:

1. Ingestion is directive-backed (Core-owned boundary preferred).
2. Ingestion idempotency uses:
   - caller-provided `dedupe_key` when available, else computed fingerprint.
3. Immutable document versions (reject conflicting dedupe keys or create explicit new version records).
4. Search requires explicit `collections` list; no implicit “search everything”.
5. Citations are required for all results, with stable `document_id`, `collection`, and safe `source_ref`.
6. Do not persist raw query strings; store query hashes and metadata only.
7. Strict secret detection: reject ingestion that contains high-confidence secrets (or redact-before-store, but be consistent).

---

## 10) Open questions (explicit)
1. Does Graphonomous expose an explicit `dedupe_key` in the `graph_ingest` tool interface as a first-class input for MVP, or rely on computed fingerprints only?
2. Are document updates modeled as immutable versions (recommended) or update-in-place?
3. What is the canonical citation schema Core UI will display (field naming and required fields)?
4. What retention/compaction policy applies to raw content vs embeddings vs graph artifacts per collection?
5. If external embedding APIs are used, what are the default egress allowlists and secret store integration details?
