# Graphonomous — Component Project Spec

Graphonomous is the portfolio’s **knowledge agent** (Arcana-backed graph-native RAG).

Canonical portfolio context: `opensentience.org/project_spec/portfolio-integration.md`.

## Read this spec in order (recommended)

The following companion specs now exist in this directory. Read them in this order:

1. `ARCHITECTURE.md` — boundaries, tenancy model, Arcana integration stance
2. `INTERFACES.md` — tools + signals + directives + error contracts (Core-routed)
3. `PERMISSIONS.md` — graph read/write scopes and enforcement points
4. `SECURITY.md` — redaction rules, ingestion safety, prompt-injection posture
5. `EXECUTION_MODEL.md` — ingestion idempotency, retention hooks, replay stance
6. `RESOURCE_SURFACES.md` — repo-local `.fleetprompt/graphonomous/` formats
7. `TEST_PLAN.md` — minimal tests to prevent regressions

## Responsibilities

- Ingest documents into collections
- Perform graph-native searches
- Provide citations/provenance
- Support multi-collection queries

## Tool interface (as OpenSentience Agent)

Tool identifiers are globally namespaced when exposed via OpenSentience Core ToolRouter as `<agent_id>/<tool_name>`.

Canonical tool IDs (Core-routed) should be:

- `com.graphonomous.core/graph_search({"query": string, "collections": [string], "graph_mode"?: boolean})`
- `com.graphonomous.core/graph_ingest({"content": string, "collection": string, "metadata"?: object})`
- `com.graphonomous.core/graph_list_collections({})`

Notes:
- `graph_ingest` is a side-effectful write and should be directive-backed when initiated from chat/tool calling flows.
- Tool inputs/outputs must be secret-free and safe to persist in audit logs.

## Storage

- Collections are tenant/project-scoped.
- Persist embeddings + graph structures in a dedicated store (implementation choice: Postgres recommended if Arcana expects it).

## Security

- Ingestion is a side-effectful write: should be directive-backed if initiated from chat/tool calling.
- Never store secrets in documents/metadata.
- Support redaction at ingestion time (MVP: denylist keys like `api_key`, `token`, `authorization`).

## MVP slice

1. Basic collection management
2. Ingest plain text documents
3. Graph search with top-k results + citations
4. Minimal admin visibility via OpenSentience UI (list collections + recent ingests)
