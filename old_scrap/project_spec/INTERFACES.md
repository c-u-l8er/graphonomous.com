# Graphonomous Interfaces (as an OpenSentience Agent)

This document defines the stable **interface surface** for **Graphonomous** when running as an OpenSentience Agent.

It specifies:
- canonical tool identifiers (namespaced as `<agent_id>/<tool_name>`)
- tool request/response schemas (JSON-ish, JSON Schema-like)
- emitted signals (facts)
- requested directives (intent / side effects)
- error contracts and safety requirements (secret-free durable records)

Portfolio alignment:
- `Project[&]/project_spec/standards/signals-and-directives.md`
- `Project[&]/project_spec/standards/tool-calling-and-execution.md`
- `Project[&]/project_spec/standards/security-guardrails.md`

---

## 0) Naming, IDs, and compatibility

### 0.1 Canonical tool IDs (namespaced)
OpenSentience Core exposes tools globally as:

- `<agent_id>/<tool_name>`

For Graphonomous, assume:

- `agent_id = "com.graphonomous.core"`

Canonical tool IDs:
- `com.graphonomous.core/graph_search`
- `com.graphonomous.core/graph_ingest`
- `com.graphonomous.core/graph_list_collections`

(Additional tools may exist later, but the above are the v1 baseline.)

### 0.2 Correlation and audit linkage fields
Where possible, Graphonomous must include portfolio-standard linking fields in signals and durable records:

- `correlation_id` (tie to upstream user request / workflow / mission)
- `causation_id` (optional; the immediate upstream cause, e.g., directive id)
- `subject_type` / `subject_id` (e.g., `graphonomous.collection`, `graphonomous.ingest`, `graphonomous.query`)

### 0.3 Versioning
- This interface is **v1**.
- Prefer additive changes (new optional fields) over breaking schema changes.
- Breaking changes should use a new tool name (e.g., `graph_search_v2`) unless Core supports schema version negotiation.

---

## 1) Tools (Core-routed API)

All tool inputs/outputs MUST be **secret-free**.

### 1.1 `com.graphonomous.core/graph_search`

Search one or more collections and return results with citations/provenance.

#### Input
```json
{
  "query": "string",                     // required
  "collections": ["string"],             // required; list of collection ids
  "top_k": 10,                           // optional; default 10
  "graph_mode": true,                    // optional; default true
  "filters": {                           // optional; structured, declarative filters
    "source_type": ["repo_file", "url"]  // example only; see §1.1.3
  }
}
```

#### Output
```json
{
  "query_id": "string",                  // stable id for this search
  "results": [
    {
      "score": 0.0,                      // higher is more relevant
      "text": "string",                  // excerpt/summary (secret-free)
      "document": {
        "document_id": "string",
        "collection": "string",
        "title": "string?",
        "source_type": "repo_file|url|note|unknown",
        "source_ref": "string?",         // e.g. repo path or URL (must be safe to persist)
        "ingested_at": "string?"         // RFC3339 if available
      },
      "citations": [
        {
          "citation_id": "string",
          "document_id": "string",
          "source_ref": "string?",       // repeated for convenience
          "span": { "start": 0, "end": 0 }, // optional character offsets in source (if known)
          "quote": "string?",            // optional; small excerpt, safe to persist
          "hash": "string?"              // optional content hash for integrity
        }
      ],
      "entities": [                      // optional; graph_mode output
        { "type": "string", "value": "string", "id": "string?" }
      ],
      "relationships": [                 // optional; graph_mode output
        { "from": "string", "to": "string", "type": "string", "evidence": "string?" }
      ]
    }
  ],
  "warnings": ["string"]                 // optional; safe, non-sensitive warnings
}
```

#### Permission requirements
- Caller must have `graph:read:<collection_id>` for each requested collection (or a covering scope, if your matcher supports it).

#### Semantics
- Search is generally **non-side-effectful** and may be executed directly as a tool call.
- Results must include **citations/provenance** sufficient for:
  - human inspection in the Core UI
  - audit timeline linking (query_id, collections)
- Query text and results must remain secret-free as persisted artifacts. If the user query contains secrets, Graphonomous should:
  - avoid persisting the raw query text in durable logs/signals, and/or
  - redact obvious secret patterns (best-effort), depending on portfolio policy.

#### Filters (MVP guidance)
Filters must be purely declarative and safe to evaluate. MVP should support only:
- equality / membership checks on a small allowlist of metadata keys (e.g., `source_type`, `tags`, `project_id`).
Avoid regex and arbitrary scripting.

---

### 1.2 `com.graphonomous.core/graph_ingest`

Ingest content into a collection.

> Ingestion is a **write side effect**. When initiated from chat/tool calling, ingestion should be **directive-backed** (see §3). If your Core models tool calls as directives already, then the directive boundary may be satisfied at the Core layer; otherwise Graphonomous should request a directive before performing durable writes.

#### Input
```json
{
  "collection": "string",                 // required
  "content": "string",                    // required; plaintext/markdown (no secrets)
  "metadata": {                           // optional; must be secret-free
    "title": "string?",
    "source_type": "repo_file|url|note|unknown",
    "source_ref": "string?",              // e.g. repo path or URL
    "tags": ["string"]
  },
  "dedupe_key": "string?"                 // optional; recommended when upstream can redeliver
}
```

#### Output
```json
{
  "ingest_id": "string",
  "collection": "string",
  "status": "accepted|deduped",
  "document": {
    "document_id": "string",
    "content_hash": "string?",
    "ingested_at": "string"              // RFC3339
  }
}
```

#### Permission requirements
- Caller must have `graph:write:<collection_id>` for the target collection.

#### Semantics
- Content and metadata must be validated as **secret-free** before persistence.
- Dedupe:
  - If `dedupe_key` is present and already seen within the dedupe window for that collection, return `status = "deduped"` and the existing `document_id` (or stable reference).
- If ingestion performs enrichment (chunking, embeddings, entity extraction, relationship inference), these are internal implementation details, but the result must remain:
  - deterministic enough to audit (log versions/config used)
  - safe to persist (no secrets)

---

### 1.3 `com.graphonomous.core/graph_list_collections`

List collections visible to the caller.

#### Input
```json
{ }
```

#### Output
```json
{
  "collections": [
    {
      "collection": "string",
      "description": "string?",
      "graph_enabled": true,
      "retention_days": 365,
      "created_at": "string?"
    }
  ]
}
```

#### Permission requirements
- MVP recommendation: return only collections the caller can read (i.e., those for which the caller has `graph:read:<collection_id>`).
- If you later add administrative listing, gate via an explicit admin permission (out of scope here).

---

## 2) Signals (facts) emitted by Graphonomous

Signals are immutable facts, durable, replayable, and **secret-free**.

### 2.1 `graphonomous.query.performed`
Emitted when a search is executed.

Recommended fields:
- `query_id`
- `collections` (list of ids)
- `top_k`
- `graph_mode`
- `result_count`
- `correlation_id` / `causation_id` (if known)
- `subject_type = "graphonomous.query"`, `subject_id = query_id`

Do not persist full raw query text if it may contain secrets. Prefer:
- a redacted query summary, or
- a query hash for correlation, depending on policy.

### 2.2 `graphonomous.ingest.accepted`
Emitted when an ingest request is accepted (including deduped acceptance).

Fields:
- `ingest_id`
- `collection`
- `document_id`
- `dedupe_key` (if provided)
- `status` (`accepted|deduped`)
- `metadata_summary` (safe subset only; e.g., `source_type`, `source_ref`, `title`)
- `correlation_id` / `causation_id`
- `subject_type = "graphonomous.ingest"`, `subject_id = ingest_id`

### 2.3 `graphonomous.ingest.succeeded`
Emitted when ingestion is fully processed and durable.

Fields:
- `ingest_id`
- `collection`
- `document_id`
- `content_hash` (if computed)
- `enrichment` (optional safe summary: chunk_count, entity_count, relationship_count)
- `correlation_id` / `causation_id`
- `subject_type = "graphonomous.ingest"`, `subject_id = ingest_id`

### 2.4 `graphonomous.ingest.failed`
Emitted when ingestion fails.

Fields:
- `ingest_id` (if allocated)
- `collection`
- `error` (structured, safe; no secrets)
- `correlation_id` / `causation_id`
- `subject_type = "graphonomous.ingest"`, `subject_id = ingest_id`

---

## 3) Directives (intent) requested by Graphonomous

Graphonomous may request directives to ensure side effects are explicit and auditable.

### 3.1 `graphonomous.ingest.perform` (recommended)
Requested when an ingest is initiated from a context where the directive boundary is not already guaranteed by Core.

Directive payload (secret-free):
- `collection`
- `content_ref` OR `content` (prefer a reference if content is large)
- `metadata`
- `dedupe_key`
- `correlation_id` / `causation_id`

Outcome:
- Directive runner performs ingestion
- Graphonomous emits `graphonomous.ingest.succeeded|failed`

### 3.2 `graphonomous.collection.create` (future)
If collection creation becomes dynamic, it should be directive-backed.

### 3.3 `graphonomous.retention.compact` (future)
Retention/compaction jobs (deletions) are side-effectful and should be directive-backed, especially if deletions are irreversible.

---

## 4) Error contract (tools)

All tools should return structured errors with:
- stable machine-readable `code`
- safe human-readable `message` (no secrets)
- optional structured `details` (safe)

### 4.1 Standard error shape
```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": { }
  }
}
```

### 4.2 Error codes (v1)
- `graph.invalid_input`
  - schema validation failed (missing fields, wrong types, invalid sizes)
- `graph.permission_denied`
  - caller lacks `graph:read:*` or `graph:write:*` scope for requested collection(s)
- `graph.collection_not_found`
  - unknown collection id
- `graph.payload_rejected`
  - content/metadata contains disallowed keys or appears to contain secrets (best-effort detection)
- `graph.dedupe_conflict`
  - dedupe_key exists but conflicts with incompatible attributes (if enforced)
- `graph.backend_unavailable`
  - underlying store/Arcana backend not reachable
- `graph.internal_error`
  - unexpected failure (must not leak internal details)

---

## 5) Safety defaults (recommended)

### 5.1 Size limits
Recommended MVP limits (configurable):
- `query` max length: 8 KB
- `content` max length: 256 KB (or require `content_ref` for larger)
- `metadata` max size: 16 KB
- `collections` max count per query: 20
- `top_k` max: 50

### 5.2 Secret key denylist (best-effort)
Reject or redact values under common secret keys anywhere in `metadata` (and never persist them):
- `api_key`, `token`, `authorization`, `cookie`, `set-cookie`, `password`, `secret`, `private_key`, `client_secret`

---

## 6) Streaming and cancellation (capabilities)
If supported by the agent/runtime protocol:
- `graph_search` may stream partial results (progressive top-k)
- `graph_ingest` may stream enrichment progress (chunking/embedding/entity extraction)
- Long-running operations should be cancelable (best-effort), with final durable status reflected via signals.

Cancellation should never leave partial durable artifacts without a terminal audit record (succeeded/failed/canceled).

---