# Graphonomous Resource Surfaces (`.fleetprompt/graphonomous/`)

This document defines the **repo-local**, safe-to-index resource formats that Graphonomous consumes (directly or via OpenSentience Core indexing) to configure:

- knowledge **collections**
- optional **entity/relationship** modeling hints for graph-native retrieval
- optional **document schema** expectations for ingestion-time validation

It is designed to align with portfolio standards:

- Repo-first resources: `.fleetprompt/` in the project is the **source of truth**.
- Safe indexing: OpenSentience Core can index/validate these files **without executing code**.
- No secrets in durable artifacts (resources, signals, directives, logs).
- Prefer additive, versioned schemas.

Related canonical context:
- `Project[&]/opensentience.org/project_spec/portfolio-integration.md`
- `Project[&]/project_spec/standards/local-resource-conventions.md`
- `Project[&]/project_spec/standards/security-guardrails.md`
- `Project[&]/project_spec/standards/signals-and-directives.md`

---

## 0) Scope and non-goals

### In scope
- Directory layout under `.fleetprompt/graphonomous/`
- `collections.json` schema (v1): collections + graph modeling hints
- Optional schema files under `.fleetprompt/graphonomous/schemas/`
- Validation rules (what must be rejected by Core and/or Graphonomous)

### Out of scope (for this document)
- Tool interface (e.g., `com.graphonomous.core/graph_search`, `.../graph_ingest`)
- Storage engine choices (Postgres vs other), Arcana internals
- Multi-tenant provisioning details (Delegatic / Core), beyond how IDs should be scoping-friendly
- Full JSON Schema support (we intentionally use a safe subset)

---

## 1) Directory layout

Graphonomous resources live under:

- `.fleetprompt/graphonomous/`

Recommended structure:

- `.fleetprompt/graphonomous/collections.json` (recommended; required if using Graphonomous config)
- `.fleetprompt/graphonomous/schemas/` (optional; schema declarations for ingestion-time validation)
  - `.fleetprompt/graphonomous/schemas/<collection_id>.document.json` (optional)
  - `.fleetprompt/graphonomous/schemas/entities.json` (optional)
  - `.fleetprompt/graphonomous/schemas/relationships.json` (optional)
- `.fleetprompt/graphonomous/README.md` (optional human notes)

Rules:
- All paths are repo-relative under `.fleetprompt/graphonomous/`.
- No remote references. No network calls during indexing.

---

## 2) `collections.json` (v1)

### 2.1 Purpose

`collections.json` declares what knowledge stores (“collections”) exist for a project and provides optional graph modeling hints:

- which collections exist and their characteristics
- whether graph mode is enabled per collection
- which entity types are expected
- relationship modeling hints between entity types

This enables:
- safe indexing by Core for UI visibility and validation
- Graphonomous to preconfigure Arcana (or equivalent) consistently
- predictable permission scoping (read/write by collection)

### 2.2 Canonical location

- `.fleetprompt/graphonomous/collections.json`

### 2.3 Top-level schema (v1)

Top-level object:

- `version` (integer, required): must be `1`
- `collections` (array, required): list of collection declarations
- `relationships` (array, optional): graph relationship modeling hints across entity types
- `defaults` (object, optional): project-level defaults (embedding model, retention, etc.)

#### Example

    {
      "version": 1,
      "defaults": {
        "embedding_model": "text-embedding-3-small",
        "graph_enabled": true,
        "retention_days": 365
      },
      "collections": [
        {
          "id": "customer_docs",
          "description": "Customer technical documentation",
          "embedding_model": "text-embedding-3-small",
          "graph_enabled": true,
          "entity_types": ["product", "feature", "bug", "customer"],
          "retention_days": 365
        },
        {
          "id": "code_knowledge",
          "description": "Source code and API documentation",
          "embedding_model": "text-embedding-3-small",
          "graph_enabled": true,
          "entity_types": ["function", "module", "dependency"],
          "retention_days": null
        }
      ],
      "relationships": [
        { "from": "customer", "to": "bug", "type": "reported", "bidirectional": false },
        { "from": "product", "to": "feature", "type": "includes", "bidirectional": true }
      ]
    }

### 2.4 Collection object schema

Each `collections[]` entry:

Required:
- `id` (string): stable identifier
- `description` (string): human-readable

Optional:
- `embedding_model` (string): model identifier string
- `graph_enabled` (boolean): default comes from `defaults.graph_enabled` or false
- `entity_types` (array of strings): enumerated entity labels expected in this collection (hints)
- `retention_days` (integer | null): number of days to retain, or `null` for “no TTL”
- `ingest` (object): ingestion-time expectations (size caps, allowed sources), declarative only
- `tags` (array of strings): for UI grouping

`ingest` (optional) fields (MVP-friendly):
- `max_document_bytes` (integer, optional): reject larger ingests unless overridden
- `allow_sources` (array of strings, optional): allowlisted source tags (e.g., `["git", "docs", "manual"]`)
- `deny_mime_types` (array of strings, optional): e.g. `["application/zip"]`

### 2.5 Relationship object schema

Each `relationships[]` entry (optional; modeling hints, not enforcement):

Required:
- `from` (string): entity type label
- `to` (string): entity type label
- `type` (string): relationship label (e.g., `includes`, `reported`)
Optional:
- `bidirectional` (boolean): default `false`
- `description` (string): human readable
- `collection_scopes` (array of strings): list of collection ids where this relationship is expected; omit means “applies generally”

---

## 3) ID and naming rules (normative)

### 3.1 Collection IDs
Collection `id` must be:
- stable (do not rename casually; treat as part of audit history)
- safe for filesystem/database usage
- unique within the project

Recommended constraints (validate in Core indexing):
- length: 1–64 chars
- allowed: lowercase letters, digits, `_` and `-`
- must start with a letter

Example valid IDs:
- `customer_docs`
- `code-knowledge`
- `product_specs_2026`

Example invalid IDs:
- `CustomerDocs` (uppercase)
- `../../secrets` (path traversal)
- `customer docs` (space)

### 3.2 Entity type labels
Entity type strings should be:
- lowercase snake_case or kebab-case
- short, stable labels (e.g., `customer`, `bug`, `function`)
- unique within a project’s modeling vocabulary

### 3.3 Relationship type labels
Relationship `type` should be:
- lowercase snake_case or kebab-case
- stable verbs/nouns (e.g., `reported`, `includes`, `depends_on`)

---

## 4) `schemas/` (optional)

### 4.1 Purpose

Schema files under `.fleetprompt/graphonomous/schemas/` are optional. They provide stronger ingestion-time validation without requiring code execution.

They can be used for:
- validating document metadata structure
- validating entity extraction outputs (if you store derived entities)
- validating relationship edge structures (if you store edges explicitly)

These schemas must remain **pure data** and use a restricted subset to ensure safe indexing.

### 4.2 Recommended files

#### 4.2.1 Per-collection document schema
- `.fleetprompt/graphonomous/schemas/<collection_id>.document.json`

Intended to validate (at minimum) `metadata` associated with ingested documents, and optionally parts of the document payload if you ingest structured JSON.

Example shape you might validate:
- `metadata.source` (string)
- `metadata.uri` (string)
- `metadata.title` (string)
- `metadata.tags` (array of strings)
- `metadata.occurred_at` (date-time string)

#### 4.2.2 Entity schema (project-wide)
- `.fleetprompt/graphonomous/schemas/entities.json`

Optional schema for derived entities you might store:
- `entity_type`
- `entity_id` or `name`
- `attributes` object

#### 4.2.3 Relationship schema (project-wide)
- `.fleetprompt/graphonomous/schemas/relationships.json`

Optional schema for derived edges:
- `from_entity_type`, `from_entity_id`
- `to_entity_type`, `to_entity_id`
- `type`
- optional `confidence` / `provenance`

### 4.3 Schema language subset (MVP)

To keep things safe, schema files support a restricted subset inspired by JSON Schema:

Allowed keys at any schema node:
- `type`: `"object" | "array" | "string" | "number" | "integer" | "boolean" | "null"`
- `properties`: object mapping property names to schemas (object type)
- `required`: array of strings (object type)
- `additionalProperties`: boolean (object type; default true)
- `items`: schema (array type)
- `format`: `"date-time"` (string type only; optional)
- `enum`: array of primitive values (optional; small lists only)

Explicitly disallowed (MVP):
- `$ref`, `oneOf`, `anyOf`, `allOf`, `pattern`, `if/then/else`, `dependencies`, remote schema resolution, custom validators

### 4.4 Example: per-collection document schema

File: `.fleetprompt/graphonomous/schemas/customer_docs.document.json`

    {
      "type": "object",
      "required": ["metadata"],
      "properties": {
        "metadata": {
          "type": "object",
          "required": ["source", "uri"],
          "properties": {
            "source": { "type": "string", "enum": ["manual", "docs", "git"] },
            "uri": { "type": "string" },
            "title": { "type": "string" },
            "tags": { "type": "array", "items": { "type": "string" } },
            "occurred_at": { "type": "string", "format": "date-time" }
          },
          "additionalProperties": true
        }
      },
      "additionalProperties": true
    }

Notes:
- Keep schemas permissive unless you have strong reasons; strict schemas can make ingestion brittle.
- Never encode secrets in schema files (e.g., auth tokens, URLs with embedded credentials).

---

## 5) Validation rules (Core indexer + Graphonomous)

### 5.1 Safe indexing requirement
OpenSentience Core must be able to:
- parse `.fleetprompt/graphonomous/collections.json`
- validate it against this spec
- surface actionable errors without executing code

Graphonomous should also validate at runtime (defense in depth), but Core validation enables early feedback and safer enablement.

### 5.2 `collections.json` validation checklist
A config is valid if:
- file parses as JSON object
- `version == 1`
- `collections` is a non-empty array (recommended) or empty array (allowed)
- each collection:
  - `id` satisfies naming rules
  - `description` is present and non-empty
  - `graph_enabled` is boolean if present
  - `retention_days` is integer >= 1, or null, if present
  - `entity_types` is an array of strings if present
  - `embedding_model` is a string if present
- `relationships` is an array if present
- each relationship:
  - `from`, `to`, `type` are non-empty strings
  - `bidirectional` is boolean if present
  - if `collection_scopes` present: it only references known collection ids
- no unknown top-level keys that would change semantics silently (recommend warning, not error, for forwards compatibility)

### 5.3 Schema file validation checklist
For any schema file under `.fleetprompt/graphonomous/schemas/` that Core/Graphonomous chooses to load:
- file parses as JSON object
- schema uses only allowed subset keys (§4.3)
- schema size is bounded (recommend max file size, e.g., 256KB)
- no `$ref` or remote references

---

## 6) Security requirements

### 6.1 No secrets in resources
`.fleetprompt/graphonomous/**` must not contain:
- API keys, tokens, cookies, credentials
- URLs with embedded credentials
- private keys or signing secrets

If you need secrets for ingestion sources, store them in the portfolio secret store and reference them by id elsewhere (not in this repo surface).

### 6.2 PII and sensitive data
This spec does not define PII rules. However:
- retention_days should be used to reduce risk for sensitive collections
- ingestion pipelines should support redaction or denylisting before persistence (handled by Graphonomous ingestion logic, not by these static files)

---

## 7) How this maps to permissions (guidance)

Graphonomous operations should be gated by collection-scoped permissions (exact permission strings live in the portfolio taxonomy; keep stable and explicit). Recommended pattern:

- read/search: `graph:read:<collection_id>`
- ingest/write: `graph:write:<collection_id>`

The resource surfaces here are purely declarative and do not grant permissions by themselves.

---

## 8) Multi-tenancy / scoping guidance (portfolio integration)

These resources are **project-scoped** and repo-local. For Delegatic “companies” or other tenant constructs:

- Prefer namespacing collection ids by project and/or company at provisioning time (Core/Delegatic responsibility).
- Keep the repo-local `collections.json` as the declarative intent; runtime mapping may translate it into tenant-specific storage namespaces.

Core may cache derived indexes under `~/.opensentience/`, but the repo `.fleetprompt/graphonomous/` remains the source of truth.

---

## 9) Future extensions (non-breaking direction)

Potential v2 additions (version-gated):
- explicit per-collection access policies (still declarative; permissions remain in manifests/approvals)
- richer relationship modeling (constraints, weights, provenance fields)
- collection-level embedding parameters (chunking strategy, overlap), with strict safe indexing rules
- schema registry integration (local-first, no network during indexing)
- explicit retention/compaction policy declarations tied into Core’s audit and storage layers

When extending:
- bump `version`
- keep v1 parsing stable
- preserve “safe indexing” and “no secrets” invariants