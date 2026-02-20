# Graphonomous Architecture (as an OpenSentience Agent)

Graphonomous is the portfolio’s **knowledge agent**: a graph-native RAG layer (Arcana-backed) that provides **ingestion**, **search**, and **citations/provenance** to other OpenSentience Agents.

This document defines:
- component boundaries (what Core owns vs what Graphonomous owns)
- storage and data model (high level)
- multi-tenancy stance (project/company scoped)
- integration surfaces and operational constraints

Portfolio-aligned decisions assumed here:
- **Canonical tool identifiers are namespaced** as `<agent_id>/<tool_name>` via OpenSentience Core routing.
- **Pub/sub permissions are bus-agnostic** (`event:*`) if/when Graphonomous participates in events.
- **Repo-first resources**: `.fleetprompt/` in the project repo is the source of truth; Core may cache derived indexes under `~/.opensentience/`.

Relevant portfolio standards:
- `Project[&]/project_spec/standards/signals-and-directives.md`
- `Project[&]/project_spec/standards/security-guardrails.md`
- `Project[&]/project_spec/standards/tool-calling-and-execution.md`
- `Project[&]/project_spec/standards/agent-manifest.md`

---

## 1) Component boundaries

### 1.1 OpenSentience Core owns
Core is the **policy enforcement and audit authority**. Core must:
- Install/enable/run/stop Graphonomous as a separate agent process.
- Enforce permissions before routing tool invocations (ToolRouter).
- Maintain the portfolio audit log (security-relevant actions and outcomes).
- Index repo-local `.fleetprompt/graphonomous/` resources **without executing code**.
- Provide admin UI visibility:
  - collections, recent ingests, failures, query traces (safe summaries), storage health.

Core should treat Graphonomous as a black-box agent behind the runtime protocol; Core must not load Arcana/Graphonomous code in-process.

### 1.2 Graphonomous agent owns
Graphonomous is responsible for the **knowledge plane**:
- Collection management (create/list/describe; tenant-scoped).
- Ingestion pipeline (document normalization → chunking → embedding → graph extraction/updates).
- Search pipeline (vector + graph-aware retrieval; citations).
- Provenance model (document ids, chunk spans, source metadata, hashes).
- Defensive secret handling and redaction at ingestion time (best-effort) to maintain portfolio invariants.

Graphonomous must not:
- Persist secrets (ever) in durable artifacts.
- Expose public network listeners by default.
- Bypass Core permissions enforcement; it must re-check defensively where possible (defense-in-depth).

### 1.3 Arcana owns (library boundary)
Arcana (as the backing library/service) is responsible for the graph-native retrieval mechanics:
- embedding storage/search primitives (as implemented by Arcana)
- graph entity/relationship modeling and traversal
- hybrid ranking strategies (vector + graph)
- internal indexing/maintenance routines (implementation detail)

Graphonomous should wrap Arcana behind stable agent interfaces and portfolio guardrails (permissions, audit, redaction, tenant boundaries).

---

## 2) Internal subsystems (Graphonomous)

### 2.1 Resource Interpreter (project-facing)
Consumes repo-local `.fleetprompt/graphonomous/` resources, typically:
- `collections.json` describing collection schemas and settings

Responsibilities:
- validate schemas and constraints without executing code
- map project config into tenant-scoped collection definitions
- surface validation errors to Core UI

### 2.2 Collection Manager
Responsibilities:
- create/ensure collections exist for a given tenant scope
- list collections and basic stats
- enforce collection-level access controls (read/write scopes)

### 2.3 Ingestion Pipeline (write path)
Stages (conceptual):
1. **Input validation**
   - content is text (or a supported normalized form)
   - metadata is JSON-safe and secret-free
2. **Sanitization**
   - remove/redact known secret-like keys/values (best-effort)
   - enforce size limits (content length, metadata size, nesting depth)
3. **Normalization**
   - compute stable `document_id` (or accept caller-provided id)
   - compute content hash for dedupe/re-ingest detection
4. **Chunking**
   - deterministic chunking strategy (stable for idempotency)
5. **Embedding**
   - generate embeddings using the configured embedding model
6. **Graph extraction (optional but preferred)**
   - extract entities and relationships according to configured entity types
7. **Persist**
   - write document/chunks/embeddings/entities/edges into the tenant store
8. **Emit audit-safe facts**
   - emit signals about ingestion success/failure, including document ids and hashes (no secrets)

**Directive boundary (portfolio standard):**
- Ingestion is a side-effectful write.
- If initiated from chat/tool-calling, ingestion should be **directive-backed** (Core creates/approves intent; a runner performs the write).
- Graphonomous tools may return `{ directive_id, status }` in a directive-backed implementation, or Core may treat the tool call itself as a controlled action. Either way, the write must be auditable and permissioned.

### 2.4 Search Pipeline (read path)
Responsibilities:
- validate queries and requested collections
- enforce collection read permissions
- perform vector search, graph expansion, and ranking (via Arcana)
- return results with **citations/provenance**, including:
  - document ids
  - chunk ids and span offsets (where applicable)
  - source metadata (safe subset)
  - confidence/ranking signals (optional)

Search must be read-only and must not mutate state.

### 2.5 Provenance & Citation Model
Graphonomous must be able to explain “where the answer came from”:
- stable `document_id`
- stable `chunk_id` (or span)
- `source` metadata (e.g., file path, URL, repo, commit hash) — **must be secret-free**
- content hash of ingested material (for integrity)

This provenance model is foundational for auditability and trust.

---

## 3) Storage architecture

### 3.1 Storage requirements
Graphonomous storage must support:
- durable documents + metadata
- chunking index
- embeddings storage and similarity search
- graph entities/relationships
- tenant scoping and isolation
- retention policies (optional, per collection)
- efficient query paths (p95 latency targets are portfolio-level goals)

### 3.2 Recommended baseline: Postgres (tenant-scoped)
Default recommendation (portfolio-friendly):
- Postgres as the durable store for:
  - documents, chunks, embeddings pointers, entities, edges, indexes metadata
- Optional specialized vector extension or Arcana-managed vector indexing (implementation choice).

**Why Postgres baseline:**
- local-first operability
- strong durability guarantees
- familiar backup/inspect tooling
- multi-tenancy strategies are well-understood (schema-per-tenant or tenant-id column)

### 3.3 Retention and compaction
Collections may declare:
- `retention_days` (nullable)
- optional compaction policy (future)

Retention must not break provenance invariants unexpectedly; if content is removed, Graphonomous should preserve minimal safe metadata (ids, timestamps, hashes) for audit continuity where feasible.

---

## 4) Multi-tenancy stance (normative guidance)

Graphonomous must support knowledge isolation across:
- **projects** (repo context)
- **Delegatic companies** (multi-agent “company” context), if used

### 4.1 Tenant identity model
A “tenant” is a stable scope identifier computed from context, for example:
- `tenant_type = "project"` + `tenant_id = <repo_id_or_path_hash>`
- `tenant_type = "company"` + `tenant_id = <company_id>`

Graphonomous should store tenant scope as explicit fields in durable records or as DB schema isolation.

### 4.2 Recommended multi-tenancy strategy
**Recommended default:** schema-per-tenant (or prefix-per-tenant) in Postgres for strong logical isolation, with guardrails in the application layer.

Acceptable alternative (simpler MVP): single schema with `tenant_id` column and strict filtering + indexing.

### 4.3 Cross-tenant access is deny-by-default
- Agents must not read or write collections outside their tenant scope unless explicitly authorized by Core policy (e.g., a Delegatic company’s shared resources).
- Any shared collections must be explicitly declared and audited.

---

## 5) Permissions (architecture-level)

Graphonomous should align with the portfolio permission taxonomy (examples):
- `graph:read:<collection>` / `graph:write:<collection>` (or whatever the portfolio finalizes)
- tool invocation permissions (Core-side) for:
  - `tool:invoke:com.graphonomous.core/graph_search`
  - `tool:invoke:com.graphonomous.core/graph_ingest`

Enforcement points:
- Core ToolRouter is authoritative.
- Graphonomous must also enforce:
  - tenant scope isolation
  - collection allowlists
  - deny-by-default for unknown collections

---

## 6) Integration points

### 6.1 FleetPrompt
FleetPrompt workflows/skills can call Graphonomous tools via Core routing:
- `com.graphonomous.core/graph_search`
- `com.graphonomous.core/graph_ingest`
- `com.graphonomous.core/graph_list_collections`

Repo-local config convention:
- `.fleetprompt/graphonomous/collections.json` defines collections and schemas per project.

### 6.2 Delegatic
Delegatic companies can define shared resources:
- shared Graphonomous collections for a company
- retention and access policies per role

Graphonomous must treat the “company context” as a tenant boundary, and must not infer sharing without explicit policy from Core/Delegatic.

### 6.3 A2A Traffic (optional)
Graphonomous may:
- publish events like `knowledge.ingest.succeeded` / `knowledge.ingest.failed`
- subscribe to project events that request ingestion

If used, it must follow bus-agnostic permissions:
- `event:publish:<pattern>`
- `event:subscribe:<pattern>`

---

## 7) Security posture (architecture-level)

### 7.1 No secrets in durable artifacts
Graphonomous must ensure:
- ingested documents and metadata are secret-free, or sanitized to become secret-free
- logs, signals, and any stored query traces are secret-free
- citations do not leak secrets (e.g., avoid embedding raw auth headers or tokens in source metadata)

### 7.2 Prompt injection and content safety
Graph content may contain adversarial instructions.
Defense is architectural:
- search results are data, not instructions
- side effects must remain directive-backed and permissioned
- UI must present citations to enable operator verification

### 7.3 Drive-by actions protection
Graphonomous should not expose network endpoints by default. Any UI or HTTP surface (if added later) must be localhost-only and protected (token + CSRF), consistent with Core rules.

---

## 8) Operational characteristics (desired)

- Deterministic ingestion behavior where possible (for idempotency and reproducibility).
- Clear error reporting with stable error codes (no secret leakage).
- Backpressure controls for ingestion (rate limits, size limits).
- Metrics:
  - ingest throughput, failures, queue depth
  - query latency distributions
  - storage growth per tenant/collection

---

## 9) MVP boundaries and open decisions

### 9.1 MVP recommended scope
1. Create/list collections per tenant.
2. Ingest plain text documents with metadata, secret-safe.
3. Search across one or more collections with top-k results and citations.
4. Minimal admin visibility via Core UI.

### 9.2 Open decisions (explicit)
- Exact multi-tenancy implementation: schema-per-tenant vs tenant-id column.
- Embedding model selection and how it’s configured per collection.
- How “graph extraction” is done (rules-based vs model-based) in MVP.
- Where directive boundaries are enforced for ingestion:
  - Core-level directive runner vs Graphonomous-managed directive requests.

---

## 10) Acceptance criteria (architecture-level)
- Graphonomous runs as a separate OpenSentience Agent process.
- Core can index `.fleetprompt/graphonomous/` without executing code.
- Tenant boundaries are enforced; cross-tenant reads/writes are denied-by-default.
- Ingestion writes are auditable and permissioned; no secrets persist.
- Search returns citations/provenance sufficient to trace results back to sources.