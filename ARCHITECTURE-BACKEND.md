# Backend Architecture — Growth Intelligence Platform

## Overview

FastAPI + LangGraph multi-agent research system with hybrid memory (ChromaDB + SQLite).

```
backend/
├── app/
│   ├── main.py           # FastAPI server + REST endpoints
│   ├── agent.py          # LangGraph state graph (orchestration)
│   ├── state.py          # GraphState TypedDict definition
│   ├── tools.py          # 10 research tools + tool groups
│   ├── prompts.py        # All LLM prompts (orchestrator, agents, synthesis, artifacts)
│   └── memory/
│       ├── store.py      # MemoryStore: hybrid ChromaDB + SQLite
│       └── extractor.py  # Fact/pattern extraction with LLM
├── data/                 # Created at runtime
│   ├── memory.db         # SQLite (sessions, messages)
│   └── chroma/           # ChromaDB persistent vector storage
├── .env                  # API keys
└── pyproject.toml        # Dependencies
```

---

## API Endpoints

| Method | Endpoint                  | Description                  | Response        |
|--------|---------------------------|------------------------------|-----------------|
| POST   | `/api/query`              | Run multi-agent research     | SSE stream      |
| GET    | `/api/models`             | List available LLM models    | JSON            |
| GET    | `/api/sessions`           | List all sessions (last 20)  | JSON            |
| GET    | `/api/sessions/{id}`      | Get full session history     | JSON            |
| DELETE | `/api/sessions/{id}`      | Delete session + all data    | JSON            |
| GET    | `/api/memory/search?q=..` | Search semantic memory       | JSON            |

---

## LangGraph State Graph

```
┌─────────┐    ┌──────────────┐    ┌───────────────┐    ┌───────────┐
│  START   │───▶│   Memory     │───▶│  Orchestrator │───▶│  Route    │
│          │    │  Retrieval   │    │  (GPT-4o)     │    │ (Fan-out) │
└─────────┘    └──────────────┘    └───────────────┘    └─────┬─────┘
                      │                    │                    │
                      │ searches           │ decomposes         │ Send() x6
                      ▼                    │ into 6 tasks       │
               ┌──────────────┐            │                    │
               │ MemoryStore  │            │                    │
               │ (ChromaDB +  │            │                    │
               │  SQLite)     │            │                    │
               └──────────────┘            │                    │
                                           │                    │
┌──────────────────────────────────────────────────────────────┤
│              6 Specialist Agents (Parallel)                   │
│                                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                     │
│  │ Market   │ │Competitiv│ │ Win/Loss │                     │
│  │ Trend    │ │    e     │ │          │                     │
│  │ Agent    │ │  Agent   │ │  Agent   │                     │
│  └──────────┘ └──────────┘ └──────────┘                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                     │
│  │ Pricing  │ │Positionin│ │ Adjacent │                     │
│  │  Agent   │ │  Agent   │ │ Market   │                     │
│  │          │ │          │ │  Agent   │                     │
│  └──────────┘ └──────────┘ └──────────┘                     │
└──────────────────────────┬────────────────────────────────────┘
                           │ merge_findings
                           ▼
                 ┌──────────────────┐
                 │   Synthesis Node │
                 │   (GPT-4o)       │
                 │                  │
                 │ • Normal mode    │
                 │ • Comparison mode│
                 └────────┬─────────┘
                          │
                 ┌────────▼─────────┐
                 │  Post-Synthesis  │
                 │                  │
                 │ • Artifacts (5)  │
                 │ • Follow-ups (3) │
                 │ • Memory persist │
                 └────────┬─────────┘
                          │
                       ┌──▼──┐
                       │ END │
                       └─────┘
```

---

## GraphState

Core state flowing through every node:

```python
class GraphState(TypedDict):
    query: str                        # User query
    session_id: str                   # Session identifier
    model: str                        # Selected LLM model
    conversation_history: list[dict]  # Past messages (last 6)
    messages: Annotated[list, add_messages]
    decomposed_tasks: list[dict]      # Tasks from orchestrator
    agent_findings: Annotated[list[AgentFindings], merge_findings]
    synthesis: str                    # Final merged insight
    memory_context: dict              # Retrieved memory context
```

### AgentFindings

```python
AgentFindings = {
    agent_id: str           # e.g., "pricing_agent"
    domain: str             # e.g., "Pricing & Packaging"
    status: str             # "complete" | "failed"
    confidence: str         # "high" | "medium" | "low"
    findings: list[dict]    # Structured data
    summary: str            # Text findings
    run_history: list[dict] # Chain-of-thought trace
}
```

---

## Graph Nodes

### 1. Memory Retrieval Node

- Searches 3 memory types via ChromaDB vector similarity
- Returns top 5 semantic facts, 3 episodic summaries, 3 procedural patterns
- Injects `memory_context` into state for orchestrator

### 2. Orchestrator Node

- Receives memory context + conversation history (last 6 turns)
- GPT-4o decomposes query into 6 specialized tasks (JSON)
- Falls back to all 6 agents with raw query if parsing fails
- Output: `decomposed_tasks` list

### 3. Specialist Agent Node (x6 parallel)

- Creates a ReAct agent (`create_react_agent`) per domain
- Each agent has domain-specific tools and system prompt
- Streams events: tool calls → tool results → thoughts
- Captures full `run_history` for transparency
- Output: 1 `AgentFindings` entry merged into state

### 4. Synthesis Node

- Merges all 6 agent findings into a coherent markdown report
- Detects comparison queries via regex ("Compare X vs Y")
- Normal mode: Executive Summary → Key Findings → Recommendations → Sources
- Comparison mode: Side-by-side tables with entity headers
- Source credibility tiers: Official (5/5) → Social (1/5)

### Post-Synthesis (async, non-blocking)

- **Artifact generation**: LLM suggests which artifacts to create, then extracts each
- **Follow-up questions**: LLM generates 3 contextual next questions
- **Memory persistence**: Stores episode, extracts semantic facts & procedural patterns

---

## 6 Specialist Agents

| Agent ID               | Domain                    | Tools                                                      |
|------------------------|---------------------------|------------------------------------------------------------|
| `market_trend_agent`   | Market & Trend Sensing    | Serper, NewsData, Firecrawl, Playwright                    |
| `competitive_agent`    | Competitive Landscape     | Serper, Firecrawl, NewsData, Playwright                    |
| `win_loss_agent`       | Win/Loss Intelligence     | Serper, HN Search, HN Comments, Reddit, Firecrawl, Playwright |
| `pricing_agent`        | Pricing & Packaging       | Serper, Firecrawl, Playwright                              |
| `positioning_agent`    | Positioning & Messaging   | Serper, Firecrawl, Ad Transparency, HN Comments, Playwright |
| `adjacent_market_agent`| Adjacent Market Collision | Serper, NewsData, HN, Firecrawl, Playwright, Mixpanel, Amplitude |

### ReAct Agent Loop

```
┌─────────┐    ┌────────┐    ┌──────────┐
│  Think  │───▶│  Act   │───▶│ Observe  │
│ (reason)│    │ (tool) │    │ (result) │
└─────────┘    └────────┘    └────┬─────┘
     ▲                            │
     └────────────────────────────┘
            loop until done
```

Each agent reasons about what tool to call, executes it, observes the result, and repeats until it has enough information to produce a summary.

---

## 10 Research Tools

### Search & Data

| Tool               | Source         | Auth Required          | Description                          |
|--------------------|----------------|------------------------|--------------------------------------|
| `serper_search`    | Google (Serper)| SERPER_API_KEY         | Web search, knowledge graph          |
| `newsdata_search`  | NewsData.io    | NEWSDATA_API_KEY       | Latest news articles                 |
| `hn_search`        | Hacker News    | None (Algolia API)     | HN posts by relevance                |
| `hn_comment_search`| Hacker News    | None (Algolia API)     | HN comments (developer sentiment)    |
| `reddit_search`    | Reddit         | None (public JSON API) | Reddit posts and discussions         |

### Web Scraping

| Tool               | Method         | Description                              |
|--------------------|----------------|------------------------------------------|
| `firecrawl_scrape` | API-based      | HTML → Markdown conversion (max 8000ch)  |
| `playwright_scrape`| Headless browser| JS-heavy pages, dynamic content (max 8000ch) |

### Specialized Intelligence

| Tool                     | Source    | Description                          |
|--------------------------|-----------|--------------------------------------|
| `ad_transparency_search` | Serper    | Competitor ad strategies & messaging |
| `mixpanel_insights`      | Mixpanel  | Product analytics (top events)       |
| `amplitude_insights`     | Amplitude | User engagement metrics              |

---

## Available LLM Models

| Model ID       | Label          | Provider |
|----------------|----------------|----------|
| `gpt-4o-mini`  | GPT-4o Mini    | OpenAI   |
| `gpt-4o`       | GPT-4o         | OpenAI   |
| `gpt-4.1-mini` | GPT-4.1 Mini   | OpenAI   |
| `gpt-4.1`      | GPT-4.1        | OpenAI   |
| `gpt-4.1-nano` | GPT-4.1 Nano   | OpenAI   |
| `o4-mini`      | o4 Mini        | OpenAI   |

Default: `gpt-4o-mini`

---

## 5 Artifact Types

| Type                   | Description                                    |
|------------------------|------------------------------------------------|
| `competitive_landscape`| Companies with funding, features, positioning  |
| `trend_chart`          | Trend signals with direction and scores (0-100)|
| `pricing_table`        | Pricing models, tiers, free tier availability  |
| `sentiment_scorecard`  | Sentiment scores (0-10) by category            |
| `messaging_matrix`     | Official positioning vs. user perception gaps  |

---

## SSE Event Types

Events streamed during a query via `POST /api/query`:

| Event                 | Data Fields                                    | When                          |
|-----------------------|------------------------------------------------|-------------------------------|
| `agent_status`        | agent_id, status, message                      | Agent starts/completes        |
| `run_step`            | type, agent_id, tool?, input?, output?, content?, timestamp | Each ReAct step |
| `synthesis`           | summary, comparison?, entities?                | Final answer ready            |
| `artifact_suggestions`| suggested[], titles{}                          | Before artifact generation    |
| `artifact`            | type, title, data                              | Each artifact completed       |
| `followup_questions`  | questions[]                                    | After artifacts               |
| `error`               | message                                        | On failure                    |
| `done`                | session_id                                     | Query complete                |

---

## Dependencies

```
fastapi[standard]>=0.135.1       # Web server
langchain>=0.3.0                 # LLM framework
langchain-openai>=0.3.0          # OpenAI integration
langchain-community>=0.3.0       # Additional integrations
langgraph>=0.2.0                 # State graph orchestration
httpx>=0.27.0                    # Async HTTP client
python-dotenv>=1.0.0             # .env loading
sse-starlette>=2.0.0             # Server-sent events
pydantic>=2.0.0                  # Data validation
chromadb>=0.5.0                  # Vector database
playwright>=1.40.0               # Headless browser scraping
```
