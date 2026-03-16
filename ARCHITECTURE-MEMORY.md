# Memory System Architecture — Growth Intelligence Platform

## Overview

A 3-layer hybrid memory system combining **ChromaDB** (vector embeddings for semantic search) and **SQLite** (relational storage for conversations). Memory enables the platform to learn across sessions — retrieving prior facts, recalling past research, and reusing successful strategies.

---

## Storage Backends

```
┌────────────────────────────────┐    ┌────────────────────────────────┐
│     SQLite (memory.db)         │    │     ChromaDB (chroma/)         │
│                                │    │                                │
│  sessions                      │    │  semantic_facts collection     │
│  ├── id (UUID)                 │    │  ├── documents (fact text)     │
│  ├── title                     │    │  ├── embeddings (vectors)      │
│  ├── created_at                │    │  └── metadata                  │
│  └── updated_at                │    │     (confidence, agent, time)  │
│                                │    │                                │
│  episodic_messages             │    │  episodic_summaries collection │
│  ├── session_id (FK)           │    │  ├── documents (summaries)     │
│  ├── role (user/assistant)     │    │  ├── embeddings (vectors)      │
│  ├── content                   │    │  └── metadata                  │
│  ├── synthesis                 │    │     (session, query, domains)  │
│  ├── artifacts_json            │    │                                │
│  ├── agent_findings_json       │    │  procedural_patterns collection│
│  └── created_at                │    │  ├── documents (patterns)      │
│                                │    │  ├── embeddings (vectors)      │
└────────────────────────────────┘    │  └── metadata                  │
                                      │     (query_type, score)        │
                                      └────────────────────────────────┘
```

---

## 3 Memory Types

### 1. Semantic Memory (Facts)

Long-term factual knowledge extracted from research.

```
Storage:  ChromaDB only (semantic_facts collection)
Write:    extract_semantic_facts() after each query
Read:     search_semantic(query, n_results=5)
```

**Example entries:**

| Fact                                       | Confidence | Source Agent     |
|--------------------------------------------|------------|-----------------|
| "Pinecone raised $138M Series B in 2024"   | high       | competitive_agent |
| "Weaviate serverless starts at $25/mo"     | high       | pricing_agent    |
| "Vector DB market projected $4.5B by 2028" | medium     | market_trend_agent |

### 2. Episodic Memory (Conversations)

Full conversation history + searchable summaries.

```
Storage:  SQLite (full messages) + ChromaDB (summaries for search)
Write:    store_episode() after each query
Read:     search_episodes(query, n_results=3)  — ChromaDB
          get_session_history(session_id)       — SQLite
```

**SQLite stores:** Complete Q&A turns with synthesis, artifacts JSON, agent findings JSON.
**ChromaDB stores:** Episode summaries with metadata (session_id, query, domains researched, timestamp).

### 3. Procedural Memory (Patterns)

Learned research strategies — what tools/approaches work best for what query types.

```
Storage:  ChromaDB only (procedural_patterns collection)
Write:    extract_procedural_patterns() after each query
Read:     search_procedures(query, n_results=3)
```

**Example entries:**

| Pattern                                          | Query Type   | Success Score |
|--------------------------------------------------|-------------|---------------|
| "For pricing queries, Playwright on /pricing pages yields best data" | pricing     | 0.90 |
| "HN comments + Reddit gives strongest sentiment signal"             | sentiment   | 0.85 |
| "Combine Serper + NewsData for comprehensive market coverage"       | market_trend| 0.80 |

---

## Memory Lifecycle

### Phase 1: RETRIEVE (Before Processing)

```
User asks: "What about Weaviate pricing?"
                 │
                 ▼
  ChromaDB vector similarity search on query:
  ┌──────────────────────────────────┐
  │ Semantic:   5 relevant facts     │──┐
  │ Episodic:   3 past sessions      │──┤
  │ Procedural: 3 research patterns  │──┤
  └──────────────────────────────────┘  │
                                        │
  Injected into Orchestrator prompt  ◄──┘

  Prompt includes:
  "Relevant facts from previous research:
   - Weaviate serverless starts at $25/mo (high confidence)
   - Vector DB market projected $4.5B by 2028

   Previous research episodes:
   - Session abc123: Analyzed Pinecone vs Weaviate features

   Research approach hints:
   - For pricing queries, scraping /pricing pages via Playwright works best"
```

### Phase 2: PROCESS (During Query)

```
Orchestrator uses memory context to:
├── Avoid redundant research (already know Weaviate base price)
├── Build on past findings (reference prior comparison)
└── Use proven strategies (Playwright for pricing pages)

6 Agents execute → Synthesis generated
```

### Phase 3: PERSIST (After Response)

Three async extraction steps run after the response is streamed:

```
a) store_episode()
   ┌────────────────────────────────┐
   │ SQLite:                        │
   │   User message: "What about..." │
   │   Assistant: synthesis text    │
   │   + artifacts_json             │
   │   + agent_findings_json        │
   │                                │
   │ ChromaDB (episodic_summaries): │
   │   Summary of this episode      │
   │   Metadata: session, domains,  │
   │   query, timestamp             │
   └────────────────────────────────┘

b) extract_semantic_facts()       [via LLM]
   ┌────────────────────────────────┐
   │ Input: query + synthesis +     │
   │        agent_findings          │
   │                                │
   │ LLM extracts 5-10 facts:      │
   │ "Weaviate offers 3 tiers:     │
   │  Sandbox (free), Serverless    │
   │  ($25/mo), Enterprise"         │
   │  confidence: high              │
   │  source: pricing_agent         │
   │                                │
   │ → Stored in ChromaDB           │
   │   semantic_facts collection    │
   └────────────────────────────────┘

c) extract_procedural_patterns()  [via LLM]
   ┌────────────────────────────────┐
   │ Input: query + agent results   │
   │        (status, domains,       │
   │         summary length, tools) │
   │                                │
   │ LLM identifies 2-4 patterns:  │
   │ "Playwright scraping of        │
   │  /pricing pages produced       │
   │  comprehensive tier data"      │
   │  query_type: pricing           │
   │  success_score: 0.92           │
   │                                │
   │ → Stored in ChromaDB           │
   │   procedural_patterns collection│
   └────────────────────────────────┘
```

### Phase 4: NEXT QUERY (Cycle Repeats)

```
User: "How does Pinecone compare?"

Memory retrieves:
├── Fact: "Weaviate offers 3 tiers..." (from previous query)
├── Episode: prior Weaviate pricing research summary
└── Pattern: "use Playwright for pricing pages"

→ Orchestrator builds on prior knowledge
→ Agents skip redundant searches
→ Better, faster, cumulative results
```

---

## Memory Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                          MEMORY SYSTEM                               │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │                    WRITE PATH                                │   │
│   │                                                              │   │
│   │  Query Complete                                              │   │
│   │       │                                                      │   │
│   │       ├──▶ store_episode()                                   │   │
│   │       │    ├── SQLite: user msg + assistant msg               │   │
│   │       │    │   (synthesis, artifacts_json, findings_json)     │   │
│   │       │    └── ChromaDB: episode summary + metadata           │   │
│   │       │                                                      │   │
│   │       ├──▶ extract_semantic_facts()  [LLM]                   │   │
│   │       │    └── ChromaDB: 5-10 facts with confidence           │   │
│   │       │                                                      │   │
│   │       └──▶ extract_procedural_patterns()  [LLM]              │   │
│   │            └── ChromaDB: 2-4 patterns with success scores     │   │
│   └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │                    READ PATH                                 │   │
│   │                                                              │   │
│   │  New Query Arrives                                           │   │
│   │       │                                                      │   │
│   │       ├──▶ search_semantic(query, n=5)                       │   │
│   │       │    └── ChromaDB vector similarity → top 5 facts       │   │
│   │       │                                                      │   │
│   │       ├──▶ search_episodes(query, n=3)                       │   │
│   │       │    └── ChromaDB vector similarity → 3 past sessions   │   │
│   │       │                                                      │   │
│   │       └──▶ search_procedures(query, n=3)                     │   │
│   │            └── ChromaDB vector similarity → 3 best strategies │   │
│   │                                                              │   │
│   │  All injected into Orchestrator prompt as context             │   │
│   └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │                 SESSION MANAGEMENT                            │   │
│   │                                                              │   │
│   │  create_session()         → New UUID session in SQLite       │   │
│   │  list_sessions(limit=20)  → Recent sessions ordered by date  │   │
│   │  get_session_history(id)  → Full messages + artifacts + findings │
│   │  delete_session(id)       → SQLite cascade + ChromaDB cleanup │   │
│   └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Session Restore Flow

When loading a previous session from the sidebar:

```
Frontend: loadSession(session_id)
    │
    ▼
GET /api/sessions/{id}
    │
    ▼
MemoryStore.get_session_history(id)
    │
    ├── SQLite query: all messages for session
    │   Returns: role, content, synthesis, artifacts_json, agent_findings_json
    │
    ▼
Frontend restores:
    ├── messages[]          ← from role + (synthesis || content)
    ├── artifacts[]         ← parsed from last assistant's artifacts_json
    ├── agentStatuses[]     ← extracted from last assistant's agent_findings_json
    └── runSteps[]          ← extracted from agent_findings[].run_history[]
```

---

## Memory Extractor Details

### extract_semantic_facts()

```
Input:  query + synthesis + agent_findings (all 6 agents)
LLM:    FACT_EXTRACTION_PROMPT
Output: JSON list of 5-10 facts

Each fact: {
    content: "Factual statement",
    confidence: "high" | "medium" | "low",
    source_agent: "pricing_agent"
}

Stored: ChromaDB semantic_facts collection
        ID format: {session_id}_fact_{timestamp}_{index}
```

### extract_procedural_patterns()

```
Input:  query + agent_findings analysis
        (status, domain, summary length, tool calls)
LLM:    Identifies what worked/didn't work
Output: 2-4 patterns

Each pattern: {
    description: "What approach worked and why",
    query_type: "pricing" | "competitive" | "market_trend" |
                "sentiment" | "positioning" | "adjacent",
    success_score: 0.0 - 1.0
}

Stored: ChromaDB procedural_patterns collection
        ID format: proc_{timestamp}_{index}
```

---

## Key Design Decisions

1. **Hybrid storage** — SQLite for reliable transactional session data; ChromaDB for fast vector similarity search across accumulated knowledge.

2. **LLM-powered extraction** — Facts and patterns are extracted by GPT-4o-mini, not rule-based, enabling nuanced knowledge capture.

3. **Non-blocking persistence** — Memory writes happen asynchronously after the response is streamed, so they don't add latency to the user experience.

4. **Cumulative intelligence** — Each query makes the system smarter. Prior facts inform future orchestration, and learned patterns improve tool selection.

5. **Session isolation + cross-session learning** — Sessions are independent conversations, but semantic and procedural memory accumulates across all sessions.

6. **Graceful degradation** — If memory search fails or returns empty, the system proceeds normally without prior context.
