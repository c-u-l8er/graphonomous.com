# Graphonomous — Permissions Model (Portfolio-aligned)

This document defines the permissions model for **Graphonomous**, the portfolio’s knowledge agent (Arcana-backed graph-native RAG).

It is aligned with portfolio standards and canonical specs:

- `Project[&]/project_spec/standards/signals-and-directives.md`
- `Project[&]/project_spec/standards/security-guardrails.md`
- `Project[&]/project_spec/standards/tool-calling-and-execution.md`
- `Project[&]/project_spec/standards/agent-manifest.md`
- `Project[&]/opensentience.org/project_spec/agent_marketplace.md`
- `Project[&]/opensentience.org/project_spec/portfolio-integration.md`

## 0) Key decisions (normative)

1. **Graph permissions are explicit and collection-scoped**
   - Read/write access is granted explicitly per collection (or via intentionally broad wildcards where allowed by policy).

2. **Tool identifiers are namespaced**
   - Canonical tool identifiers are routed by OpenSentience Core as `<agent_id>/<tool_name>`, e.g.:
     - `com.graphonomous.core/graph_search`
     - `com.graphonomous.core/graph_ingest`

3. **Core is the policy enforcement authority**
   - OpenSentience Core enforces approved permissions before routing tool calls.
   - Graphonomous must still enforce permissions internally as defense-in-depth.

4. **Side effects require explicit intent**
   - Writes (ingestion, entity creation/linking, schema/collection mutation) are side effects and should be **directive-backed** when initiated from chat/tool calling flows.

5. **No secrets in durable artifacts**
   - Graph content, metadata, logs, signals, and directives must be secret-free.

## 1) Permission taxonomy used by Graphonomous

Graphonomous uses the portfolio’s graph permission namespace:

- `graph:read:<collection_or_scope>`
- `graph:write:<collection_or_scope>`

### 1.1 Collection identifiers and scoping

A `<collection_or_scope>` is typically a collection id (string). Recommended conventions:

- Project-scoped collections (repo-defined): `project:<project_id>:<collection_id>`
- Company-scoped collections (Delegatic): `company:<company_id>:<collection_id>`
- Shared/system collections (rare, admin-controlled): `shared:<collection_id>`

The exact naming convention is an implementation decision, but **must be stable** and **safe to index without code execution**.

### 1.2 Wildcards and broad scopes

If wildcards are supported, treat them as privileged:

- `graph:read:*` — read any collection (should be rare)
- `graph:write:*` — write any collection (strongly discouraged)
- `graph:read:project:<project_id>:*` — read all collections for a project
- `graph:write:company:<company_id>:*` — write all collections for a company

If wildcard matching is not supported, do not accept `*` in permissions; require explicit collection ids.

### 1.3 Optional advanced scopes (future)

Not required for MVP, but reserved if you need finer control:

- `graph:schema:read:<collection>`
- `graph:schema:write:<collection>`
- `graph:entity:create:<collection>`
- `graph:entity:link:<collection>`
- `graph:query:advanced:<collection>`
- `graph:admin` (cross-tenant inspection/maintenance; Core-only)

If you introduce these, keep `graph:read` / `graph:write` semantics stable.

## 2) Required permissions per tool

Assume `agent_id = "com.graphonomous.core"`.

### 2.1 `com.graphonomous.core/graph_search`

**Purpose:** Search within one or more collections and return results with citations/provenance.

**Input (conceptual):**
- `query: string`
- `collections: [string]`
- `graph_mode?: boolean`

**Requires:**
- For each requested collection `C`:
  - `graph:read:C` (or an approved permission whose scope covers `C`)

**Notes:**
- If `collections` is empty, Graphonomous should reject the call (deny-by-default), unless an explicit default collection set is configured and permission-checked.
- Results must include citations/provenance, but must not leak secrets.

### 2.2 `com.graphonomous.core/graph_ingest`

**Purpose:** Ingest documents/records into a collection (write side effect).

**Input (conceptual):**
- `content: string` (or structured content)
- `collection: string`
- `metadata?: object` (secret-free)

**Requires:**
- `graph:write:<collection>`

**Directive boundary requirement (normative):**
- If invoked from a chat/tool calling loop (i.e., model-driven tool use), ingestion should be performed via an explicit directive boundary:
  - Tool call should create a directive (or request one) and return `{ directive_id, status }`, and a runner performs the write.
- If invoked by an internal, trusted system process (e.g., offline indexing job explicitly initiated by the user), you may allow direct execution, but it must still be auditable and permission-checked.

### 2.3 `com.graphonomous.core/graph_list_collections`

**Purpose:** Discover available collections for the caller’s current project/company scope.

**Requires (choose one approach and enforce consistently):**
- **Option A (recommended):** list only collections the caller can read
  - requires no extra permission beyond existing `graph:read:*` approvals, because output is filtered by permissions
- **Option B:** explicit permission required
  - `graph:inspect` (future scope), or `graph:read:*` in MVP

MVP recommendation: **Option A** (permission-filtered listing).

## 3) Enforcement layers (who checks what)

### 3.1 OpenSentience Core enforcement (mandatory)

Core must enforce, before routing any tool call to Graphonomous:

1. Agent is enabled (approved permissions exist).
2. For each collection `C` referenced by the tool input:
   - `graph_search`: caller has `graph:read:C`
   - `graph_ingest`: caller has `graph:write:C`
3. Audit logging:
   - record tool invocation (namespaced tool id, caller, outcome)
   - redact secrets from any logged inputs/outputs (best-effort)
   - avoid persisting full content bodies if they may contain sensitive/large data; prefer hashes and metadata (policy decision, but must be consistent)

Core is the authoritative gate: if Core denies, the call must not reach Graphonomous.

### 3.2 Graphonomous internal enforcement (defense in depth)

Graphonomous must also enforce collection-level permissions using caller identity provided by Core:

- Reject read requests for collections not permitted.
- Reject write requests for collections not permitted.
- Deny-by-default if caller identity is missing/invalid or if collection scope cannot be determined.

This protects against misconfiguration and future alternate invocation paths.

### 3.3 Time-of-check vs time-of-use

Graph writes are side effects and may be queued/retried (directive runner). Ensure that:

- Permission checks happen at **request time** (when directive is created), and
- Permission checks also happen at **run time** (when directive is executed), so revoked permissions cannot be used via previously queued work.

## 4) Directive boundaries (writes and mutating operations)

### 4.1 What counts as a side effect in Graphonomous

Side effects include (non-exhaustive):

- ingesting documents (adds/updates stored content, embeddings, graph structures)
- creating/updating/deleting entities
- creating/updating/deleting relationships
- creating/updating/deleting collections or schemas
- long-running indexing jobs that modify stored state

These should be directive-backed when initiated from model/tool calling flows.

### 4.2 Read operations (generally safe as tools)

Read-only operations can run as direct tools if:
- permission-checked
- auditable
- bounded for cost/abuse (rate limits/quotas at Core boundary)

## 5) Tenant/project/company scoping

Graphonomous must treat collections as tenant-scoped:

- A project’s `.fleetprompt/graphonomous/` config may define allowed collections and schemas.
- A Delegatic company may define shared collections across agents.

Rules:
1. **A collection identifier must map to exactly one scope** (project/company/shared).
2. Core should prevent cross-tenant reads/writes by default.
3. Graphonomous should namespace internal storage by scope to avoid accidental collisions.

## 6) Security and secrecy requirements (permission-adjacent)

Even with correct permissions:

- **No secrets in content/metadata**: ingestion must reject/redact common secret keys in metadata (`api_key`, `token`, `authorization`, `cookie`, `password`, `secret`, `private_key`, etc.).
- **No secrets in logs/signals/directives**: any derived records must remain secret-free.
- **Prompt injection posture**: Graph content may contain malicious instructions; Graphonomous outputs must not bypass directive boundaries in other systems.

## 7) Manifest guidance (`opensentience.agent.json`)

Agents that intend to use Graphonomous should request explicit graph permissions, e.g.:

- `graph:read:project:my_project:code_knowledge`
- `graph:write:project:my_project:customer_docs`

Avoid overly broad scopes like `graph:write:*` unless the agent is an admin/maintenance agent and the user explicitly approves it.

## 8) Audit requirements

Graphonomous-related actions that must be auditable:

- tool calls (search, ingest, list)
- directive creation for ingestion/mutation
- directive execution outcomes (succeeded/failed/canceled)
- collection/schema changes (if supported)

Audit entries should include:
- `correlation_id` / `causation_id` where available
- `subject_type` / `subject_id` (e.g., `graph.collection`, `graph.ingest_job`)
- collection id(s) involved
- redacted summaries/hashes rather than raw content if content may be sensitive

## 9) Open questions (explicit)

1. Collection naming convention: `project:<id>:<collection>` vs other scheme — choose and standardize portfolio-wide.
2. Wildcard semantics: do we allow `graph:read:project:<id>:*` and how is matching implemented safely?
3. Ingestion directive model: does `graph_ingest` always create directives in MVP, or only when invoked from chat/tool calling flows?
4. Storage and retention: how long are raw documents retained vs embeddings/graph structures, and how does that intersect with audit requirements?