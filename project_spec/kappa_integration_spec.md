# κ Integration Spec: Product-Level Specification
## Version 0.1.0 — Draft

> How the cyclicity invariant κ is computed, surfaced, and used across Graphonomous, BendScript, Deliberatic, TickTickClock, and the [&] Protocol.

---

## 1. Overview

κ (kappa) is a graph-theoretic invariant that measures the minimum irreducible bidirectional information flow in a directed graph. It is the routing primitive that determines whether a query region of a knowledge graph requires single-pass retrieval (κ = 0) or iterative deliberation (κ > 0).

This spec defines:
- How κ is computed
- Where it is computed in the stack
- How it routes inference
- How it is surfaced to users
- How it integrates with each product

---

## 2. Computation

### 2.1 Algorithm

```
function compute_kappa(graph):
    # Step 1: Find all strongly connected components
    sccs = tarjan_scc(graph)                    # O(V + E)
    
    # Step 2: For each nontrivial SCC (size > 1)
    results = []
    for scc in sccs where |scc| > 1:
        # Step 3: Enumerate bipartitions, find minimum bidirectional cut
        k = infinity
        for (A, B) in nontrivial_bipartitions(scc):
            edges_a_to_b = count_edges(A, B, graph)
            edges_b_to_a = count_edges(B, A, graph)
            bidirectional_cut = min(edges_a_to_b, edges_b_to_a)
            k = min(k, bidirectional_cut)
            if k == 0: break  # early exit (can't go lower)
        
        # Step 4: Record SCC with its κ value and minimum-cut partition
        results.append({
            scc: scc,
            kappa: k,
            min_cut_partition: (A_min, B_min),
            min_cut_edges: edges_achieving_minimum
        })
    
    return results
```

### 2.2 Complexity

- **SCC decomposition:** O(V + E) via Tarjan's algorithm
- **κ computation per SCC:** O(2^|SCC| × |SCC|²) in the worst case (enumerating all bipartitions)
- **Practical constraint:** For SCCs up to ~20 nodes, bipartition enumeration is feasible in real time. For larger SCCs, use approximation:
  - Approximate κ via min-cut algorithms (e.g., Stoer-Wagner on the undirected bidirectional-minimum projection)
  - Or compute only SCC membership (O(V+E)) and use SCC size as a proxy for deliberation budget

### 2.3 Incremental Updates

When an edge is added or removed from the knowledge graph:

1. **Edge addition:** Can only merge SCCs or enlarge existing ones. Re-run Tarjan on the affected component. If a new nontrivial SCC is formed, compute κ for it.
2. **Edge removal:** Can only split SCCs or shrink them. Re-run Tarjan on the affected component. Recompute κ for any remaining nontrivial SCCs.
3. **Optimization:** Maintain an SCC index alongside the knowledge graph. Incremental SCC algorithms (e.g., Bender, Fineman & Gilbert 2015) can update SCCs in O(V) amortized per edge change.

---

## 3. Routing Logic

### 3.1 The κ Router

The κ router sits between memory retrieval and reasoning. It inspects the topological structure of the retrieved subgraph and makes a routing decision.

```
function kappa_route(retrieved_subgraph):
    scc_analysis = compute_kappa(retrieved_subgraph)
    
    dag_context = nodes NOT in any nontrivial SCC
    scc_contexts = scc_analysis  # list of {scc, kappa, min_cut_partition, min_cut_edges}
    
    # DAG regions: single-pass retrieval
    retrieval_context = topological_sort_and_collect(dag_context)
    
    # SCC regions: flag for deliberation
    deliberation_tasks = []
    for scc_info in scc_contexts:
        deliberation_tasks.append({
            nodes: scc_info.scc,
            kappa: scc_info.kappa,
            fault_lines: scc_info.min_cut_edges,
            budget: deliberation_budget(scc_info.kappa)  # see §3.2
        })
    
    return {
        retrieval_context: retrieval_context,
        deliberation_tasks: deliberation_tasks,
        routing_decision: "fast" if len(deliberation_tasks) == 0 else "deliberate"
    }
```

### 3.2 Deliberation Budget Function

The deliberation budget maps κ to concrete inference parameters. This is an engineering heuristic (not proved — to be tuned empirically):

```
function deliberation_budget(kappa):
    return {
        max_iterations: kappa + 1,          # at least κ+1 passes to resolve all feedback loops
        agent_count: min(kappa, 3),          # up to 3 parallel deliberation agents for high-κ
        timeout_multiplier: 1.0 + 0.5*kappa, # more time for more complex topology
        confidence_threshold: 0.7 + 0.05*kappa  # higher bar for convergence in complex regions
    }
```

### 3.3 The Fast Path vs. Deliberation Path

```
             ┌─────────────────┐
             │  Query arrives   │
             └────────┬────────┘
                      │
                      ▼
             ┌─────────────────┐
             │  &memory.recall  │   Graphonomous retrieves relevant subgraph
             └────────┬────────┘
                      │
                      ▼
             ┌─────────────────┐
             │  κ Router        │   Compute SCCs, κ values
             └────────┬────────┘
                      │
              ┌───────┴────────┐
              │                │
         κ = 0 (all DAG)    κ > 0 (has SCCs)
              │                │
              ▼                ▼
       ┌──────────┐    ┌──────────────┐
       │ Fast Path │    │  Deliberation │
       │ single    │    │  &reason via  │
       │ pass      │    │  Deliberatic  │
       │ retrieval │    │  κ-informed   │
       └─────┬────┘    │  budget       │
             │         └──────┬───────┘
             │                │
             └───────┬────────┘
                     │
                     ▼
             ┌──────────────┐
             │  &memory.learn │   Results feed back into graph
             └──────────────┘
```

---

## 4. Product Integration

### 4.1 Graphonomous

**Where κ lives:** Computed at query time on the retrieved subgraph. Cached per SCC in the knowledge graph index; invalidated on edge changes.

**What changes:**
- `recall/2` now returns `{context, topology}` where `topology` includes SCC decomposition and κ values for each SCC in the query path.
- New function `topology/1` computes and returns the full SCC analysis for a given subgraph.
- The `learn/1` function, after adding new nodes/edges, triggers incremental SCC recomputation.

**MCP tool additions:**
```json
{
  "name": "memory_recall_with_topology",
  "description": "Retrieve context from knowledge graph with topological analysis. Returns nodes, edges, SCC decomposition, and κ values.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "max_depth": { "type": "integer", "default": 3 },
      "include_topology": { "type": "boolean", "default": true }
    }
  }
}
```

**Response shape:**
```json
{
  "context": {
    "nodes": [...],
    "edges": [...]
  },
  "topology": {
    "sccs": [
      {
        "id": "scc-1",
        "nodes": ["market-share", "r-and-d", "product-quality", "retention"],
        "kappa": 2,
        "min_cut_edges": [
          {"from": "market-share", "to": "r-and-d"},
          {"from": "product-quality", "to": "retention"}
        ],
        "routing": "deliberate"
      }
    ],
    "dag_nodes": ["founding-date", "ceo-name", "headquarters"],
    "overall_routing": "deliberate"
  }
}
```

### 4.2 Deliberatic

**What changes:**
- Accepts `kappa` and `fault_lines` as input parameters on its deliberation endpoint.
- Uses `kappa` to set argumentation depth (number of rounds).
- Uses `fault_lines` (minimum-cut edges) to generate the initial propositions that agents must argue about — these are the critical bidirectional dependencies.

**MCP tool additions:**
```json
{
  "name": "deliberate_on_scc",
  "description": "Run structured argumentation on a strongly connected knowledge cluster. Uses κ to set deliberation budget and fault lines to seed propositions.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "scc_nodes": { "type": "array", "items": { "type": "string" } },
      "scc_edges": { "type": "array" },
      "kappa": { "type": "integer" },
      "fault_lines": { "type": "array" },
      "governance": { "type": "object" }
    }
  }
}
```

### 4.3 BendScript

**What changes:**

#### Visual Layer
- **SCC clusters rendered visually:** Nodes within a nontrivial SCC share a colored halo or background region. Color intensity or pulse rate scales with κ.
- **DAG regions rendered with directional flow:** Edges in DAG regions show animated particles flowing in one direction. Edges within SCCs show bidirectional particle flow.
- **Minimum-cut edges highlighted:** The edges that define the minimum bidirectional cut are rendered in a distinct style (dashed, colored, thicker) — these are the "fault lines" of the cluster.
- **κ badge on SCC clusters:** Each SCC cluster shows its κ value as a small badge, e.g., "κ=2".

#### Interaction Layer
- **Topology preview on edge creation:** When the user hovers over a potential new edge, BendScript previews:
  - "This edge would create a new SCC (κ = 1). The AI will deliberate on this cluster."
  - "This edge increases κ from 1 to 2 in this cluster."
  - "This edge has no topological effect (stays in the same SCC)."
- **"Bend" action formalized:** The right-click context menu gains a "Bend" option on DAG nodes — automatically suggests an edge that would create a feedback loop with nearby nodes, transforming the local region from retrieval to deliberation.
- **"Unbend" action:** On SCC nodes, suggests which edge to remove to simplify back to a DAG (the minimum-cut edge — removing it is the cheapest way to break the feedback loop).

#### HUD
- **Global κ display:** The existing HUD (nodes / edges / depth / zoom) gains a κ readout showing the maximum κ across all SCCs in the graph, and a count of SCCs.
- **Routing indicator:** "Mode: RETRIEVAL" (all κ = 0) or "Mode: DELIBERATION (3 SCCs, max κ = 2)".

### 4.4 The [&] Protocol

**Grammar extension:**

```
# Extended [&] capability grammar — topology-aware routing

# New built-in capability
TopologyOp      := "&topology" "." ("analyze" | "route" | "kappa")

# Updated pipeline pattern
InferencePipeline :=
    "&memory.recall" "(" QueryExpr ")"
    "|>" "&topology.analyze" "()"        # Compute SCCs + κ
    "|>" "&topology.route" "()"          # Route: fast vs deliberate
    "|>" "&reason.deliberate" "(" "budget:" ":κ" ")"  # Deliberatic with κ budget
    "|>" "&memory.learn" "()"            # Results back to graph
```

**Schema extension (ampersand.schema.json):**

```json
{
  "capabilities": {
    "&topology.analyze": {
      "provider": "graphonomous",
      "description": "Compute SCC decomposition and κ values for a subgraph",
      "config": {
        "max_scc_size_for_exact": 20,
        "approximation": "stoer_wagner"
      }
    },
    "&topology.route": {
      "provider": "builtin",
      "description": "Route inference based on κ: DAG regions → fast path, SCC regions → deliberation",
      "config": {
        "deliberation_provider": "deliberatic",
        "fast_path_provider": "graphonomous"
      }
    }
  }
}
```

### 4.5 TickTickClock

**Connection:** For discrete time-series dynamics, the transition graph of the system has κ > 0 if and only if the system has a periodic orbit. TickTickClock can use this as a formal periodicity detector:

- Discretize time-series data into state transitions
- Build the transition graph
- Compute κ
- κ > 0 → periodic pattern detected, flag for temporal reasoning
- κ = 0 → pure drift, no recurrence

This is a secondary integration (TickTickClock already has Mamba SSM for pattern detection), but it provides a complementary structural signal.

### 4.6 OpenSentience

**Role:** Research home for the theoretical foundations. Hosts:
- The κ paper (theoretical background, proofs, categorical framework)
- The proof code (runnable verification)
- Interactive demos (live κ computation on user-constructed graphs)
- The original Scale Topology Axis essay (broader theoretical context connecting κ to physics, cosmology, and consciousness science)

---

## 5. Implementation Priority

### Phase 1: Core (ship first)
- [ ] Port κ computation to Elixir (Graphonomous server-side)
- [ ] Port κ computation to JavaScript (BendScript client-side)
- [ ] Integrate Tarjan's SCC into Graphonomous's graph index
- [ ] Return topology annotations from `memory_recall`
- [ ] Add SCC visualization to BendScript canvas

### Phase 2: Routing (ship second)
- [ ] Implement κ router in the [&] pipeline
- [ ] Connect κ router to Deliberatic trigger
- [ ] Add deliberation budget function
- [ ] Test on real knowledge graph queries: does κ-aware routing improve answer quality?

### Phase 3: Polish (ship third)
- [ ] BendScript topology preview on edge hover
- [ ] Bend/Unbend context menu actions
- [ ] HUD κ display and routing indicator
- [ ] TickTickClock periodicity detection via κ
- [ ] OpenSentience publication of κ paper and demos

### Phase 4: Optimization
- [ ] Incremental SCC maintenance (avoid full recomputation on every edge change)
- [ ] Approximate κ for large SCCs (> 20 nodes)
- [ ] Benchmark: latency impact of topology computation on query path
- [ ] A/B test: κ-routed inference vs. uniform retrieval on quality metrics

---

## 6. Success Metrics

| Metric | Baseline (no κ) | Target (with κ) | How to Measure |
|---|---|---|---|
| Answer coherence on circular topics | Human eval ~60% | Human eval ~80% | Blind eval on queries touching SCCs |
| Unnecessary deliberation calls | N/A (no routing) | < 20% of queries | Track κ=0 queries that hit deliberation anyway |
| Deliberation convergence speed | Fixed rounds | κ+1 rounds avg | Measure rounds to convergence |
| User engagement in BendScript | Nodes/edges per session | +30% | Track topology actions (bend/unbend/stargate) |
| OpenSentience traffic | Baseline | Organic from dev community | Track referrals from product UIs |

---

*Spec version: 0.1.0. Status: Draft. Depends on: kappa_reference.py (computation), kappa_theory_applied.md (theoretical foundations), kappa_proof.py (verification). Products affected: Graphonomous, Deliberatic, BendScript, [&] Protocol, TickTickClock, OpenSentience.*
