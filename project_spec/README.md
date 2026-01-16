# Graphonomous — Component Project Spec

Graphonomous is the portfolio’s **knowledge agent** (Arcana-backed graph-native RAG).

Canonical portfolio context: `opensentience.org/project_spec/portfolio-integration.md`.

## Responsibilities

- Ingest documents into collections
- Perform graph-native searches
- Provide citations/provenance
- Support multi-collection queries

## Tool interface (as OpenSentience Agent)

Proposed tools (aligning with `portfolio-integration.md`):

- `graph_search({"query": string, "collections": [string], "graph_mode"?: boolean})`
- `graph_ingest({"content": string, "collection": string, "metadata"?: object})`
- `graph_list_collections({})`

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
