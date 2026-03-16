# Scaling to Production — Growth Intelligence Platform

## Current State

The application is a **single-user, single-instance prototype** with:
- SQLite (file-based, single-writer)
- ChromaDB (file-based, local persistence)
- No authentication or user isolation
- Global shared state in memory
- No rate limiting, caching, or observability

This document covers what needs to change for **multi-user, horizontally-scalable production deployment**.

---

## Architecture: Current vs Production

### Current (Single Instance)

```
┌──────────┐     ┌─────────────────────────────────┐
│ Browser  │────▶│  FastAPI (single process)        │
│ (1 user) │     │                                  │
└──────────┘     │  ┌───────────┐  ┌────────────┐  │
                 │  │ SQLite    │  │ ChromaDB   │  │
                 │  │ (file)    │  │ (file)     │  │
                 │  └───────────┘  └────────────┘  │
                 └─────────────────────────────────┘
```

### Production (Multi-User, Scalable)

```
                        ┌──────────────┐
                        │   CDN/WAF    │
                        │  (Cloudflare)│
                        └──────┬───────┘
                               │
                        ┌──────▼───────┐
                        │ Load Balancer│
                        │  (ALB/Nginx) │
                        └──────┬───────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
       ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
       │  FastAPI     │ │  FastAPI     │ │  FastAPI     │
       │  Instance 1  │ │  Instance 2  │ │  Instance N  │
       │  (Gunicorn)  │ │  (Gunicorn)  │ │  (Gunicorn)  │
       └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
              │                │                │
              └────────────────┼────────────────┘
                               │
          ┌────────────┬───────┼───────┬────────────┐
          │            │       │       │            │
   ┌──────▼────┐ ┌─────▼──┐ ┌─▼────┐ ┌▼─────────┐ ┌▼──────────┐
   │ PostgreSQL│ │ Redis  │ │Qdrant│ │ Object   │ │ Message   │
   │ (sessions │ │ (cache │ │(vec- │ │ Storage  │ │ Queue     │
   │  users,   │ │  rate  │ │ tor  │ │ (S3 for  │ │ (Celery/  │
   │  history) │ │  limit)│ │ DB)  │ │  exports)│ │  Bull)    │
   └───────────┘ └────────┘ └──────┘ └──────────┘ └───────────┘
```

---

## Changes Required (By Category)

---

### 1. Database: SQLite → PostgreSQL

**Why:** SQLite is single-writer, file-based, can't be shared across instances.

**Changes:**

| Current | Production |
|---------|-----------|
| `sqlite3.connect("memory.db")` | `asyncpg` connection pool |
| File-based, local disk | Managed PostgreSQL (AWS RDS / Supabase / Neon) |
| No connection pooling | Pool of 10-20 connections per instance |
| No migrations | Alembic migration framework |
| Bare SQL strings | SQLAlchemy ORM or raw asyncpg |

**Schema stays the same** (sessions, episodic_messages) but gains:
- Proper indexes on `session_id`, `created_at`
- Foreign key constraints with CASCADE delete
- Row-level locking for concurrent writes
- JSONB columns for artifacts/findings (queryable)
- TTL via `pg_cron` or application-level cleanup

```python
# Current
conn = sqlite3.connect(self._db_path)

# Production
from asyncpg import create_pool
pool = await create_pool(dsn=os.getenv("DATABASE_URL"), min_size=5, max_size=20)
async with pool.acquire() as conn:
    await conn.execute(...)
```

---

### 2. Vector DB: ChromaDB → Managed Vector Database

**Why:** ChromaDB PersistentClient is file-based, single-process, no concurrent access.

**Options:**

| Option | Pros | Cons |
|--------|------|------|
| **Qdrant** (recommended) | Self-hosted or cloud, fast, good filtering | Extra infra |
| **Pinecone** | Fully managed, serverless | Vendor lock-in, cost |
| **Weaviate Cloud** | Managed, hybrid search | Complexity |
| **pgvector** | Use existing PostgreSQL, simpler infra | Slower at scale |

**Recommended: Qdrant Cloud or pgvector** (depending on scale)

```python
# Current
self._chroma = chromadb.PersistentClient(path="./data/chroma")

# Production (Qdrant)
from qdrant_client import QdrantClient
client = QdrantClient(url=os.getenv("QDRANT_URL"), api_key=os.getenv("QDRANT_API_KEY"))

# Production (pgvector — simpler, uses existing PostgreSQL)
# Store embeddings as VECTOR(1536) columns in PostgreSQL
# Similarity search via: ORDER BY embedding <=> query_embedding LIMIT 5
```

---

### 3. Authentication & Multi-Tenancy

**Why:** Currently zero user isolation — all sessions are global.

**Add:**

```
┌──────────┐     ┌──────────────┐     ┌─────────────────┐
│ Frontend │────▶│ Auth Provider│────▶│ FastAPI + JWT   │
│          │     │ (Clerk/Auth0/│     │ middleware      │
│          │     │  Supabase)   │     │                 │
└──────────┘     └──────────────┘     └─────────────────┘
```

**Changes:**

- Add `user_id` column to `sessions` table
- All queries filtered by `WHERE user_id = $1`
- JWT validation middleware on all endpoints
- Per-user rate limiting (see section 5)
- Per-user API key management (optional — bring-your-own OpenAI key)

```python
# Every endpoint gains user context
@app.post("/api/query")
async def query(request: QueryRequest, user: User = Depends(get_current_user)):
    session_id = request.session_id or memory_store.create_session(user_id=user.id)
    ...
```

---

### 4. Caching Layer: Add Redis

**Why:** Repeated queries, model list lookups, and rate limiting need fast shared state.

**Use Redis for:**

| Purpose | Key Pattern | TTL |
|---------|-------------|-----|
| Query result cache | `cache:query:{hash}` | 1 hour |
| Rate limiting | `rate:{user_id}:{minute}` | 1 min |
| Session store | `session:{id}` | 24 hours |
| Model list | `models:list` | 10 min |
| Agent status (live) | `status:{session_id}` | 5 min |

```python
import redis.asyncio as redis

r = redis.from_url(os.getenv("REDIS_URL"))

# Cache repeated queries
cache_key = f"cache:query:{hashlib.sha256(query.encode()).hexdigest()}"
cached = await r.get(cache_key)
if cached:
    return json.loads(cached)  # Skip entire agent pipeline
```

---

### 5. Rate Limiting & Quotas

**Why:** Each query triggers 30-60 external API calls. Uncontrolled access = cost explosion.

**Implement at 3 levels:**

```
Level 1: API Gateway / Load Balancer
├── IP-based rate limiting (100 req/min per IP)
├── Request size limits (10KB body max)
└── Connection timeout (60s)

Level 2: Application Middleware (FastAPI)
├── Per-user rate limiting via Redis
│   ├── Free tier:  5 queries/hour
│   ├── Pro tier:   50 queries/hour
│   └── Enterprise: unlimited
├── Concurrent query limit (1 active query per user)
└── Token budget per query (cap LLM spend)

Level 3: External API Protection
├── Serper: 10 req/sec max, retry with exponential backoff
├── OpenAI: Token-based budgeting per query
├── Firecrawl: Queue with concurrency=3
└── Playwright: Browser pool (max 5 instances)
```

```python
# Middleware example
@app.middleware("http")
async def rate_limit(request: Request, call_next):
    user_id = get_user_from_token(request)
    key = f"rate:{user_id}:{int(time.time()) // 60}"
    count = await redis.incr(key)
    await redis.expire(key, 60)
    if count > RATE_LIMITS[user.tier]:
        return JSONResponse(status_code=429, content={"error": "Rate limit exceeded"})
    return await call_next(request)
```

---

### 6. Resource Pooling & Connection Management

**Current problem:** Every tool call creates new HTTP clients, every DB operation creates new connections, Playwright launches a new browser per scrape.

**Fix:**

#### a) HTTP Client Pool

```python
# Current (in every tool)
async with httpx.AsyncClient(timeout=30) as client:  # New per call
    ...

# Production: Shared client with connection pooling
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http_client = httpx.AsyncClient(
        timeout=30,
        limits=httpx.Limits(max_connections=100, max_keepalive_connections=20)
    )
    yield
    await app.state.http_client.aclose()
```

#### b) Playwright Browser Pool

```python
# Current: New browser per scrape call (200-500MB each)
async with async_playwright() as p:
    browser = await p.chromium.launch()  # EXPENSIVE

# Production: Shared browser pool
class BrowserPool:
    def __init__(self, max_size=5):
        self._semaphore = asyncio.Semaphore(max_size)
        self._browser = None

    async def get_page(self):
        async with self._semaphore:
            if not self._browser:
                p = await async_playwright().start()
                self._browser = await p.chromium.launch(headless=True)
            page = await self._browser.new_page()
            try:
                yield page
            finally:
                await page.close()
```

#### c) LangGraph Compilation Cache

```python
# Current: Graph rebuilt every request
async def run_agent(...):
    graph = build_graph()  # Expensive

# Production: Build once, reuse
_compiled_graph = None

def get_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_graph()
    return _compiled_graph
```

---

### 7. Background Task Processing

**Why:** Memory extraction (fact/pattern) is slow and shouldn't block the response stream.

**Current:** Runs inline after streaming completes (blocking).

**Production:** Use a task queue.

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  FastAPI         │────▶│  Redis Queue │────▶│  Celery Worker  │
│  (streams SSE)   │     │              │     │                 │
│                  │     │  Tasks:      │     │  • Extract facts│
│  After synthesis:│     │  • memory    │     │  • Extract      │
│  enqueue memory  │     │    persist   │     │    patterns     │
│  tasks           │     │  • artifact  │     │  • Generate     │
│                  │     │    generate  │     │    artifacts    │
└─────────────────┘     └──────────────┘     └─────────────────┘
```

```python
# Current
store.store_episode(...)  # Blocking in async context
facts = await extract_semantic_facts(...)  # Slow LLM call

# Production
from celery import Celery
celery_app = Celery(broker=os.getenv("REDIS_URL"))

@celery_app.task
def persist_memory(session_id, query, synthesis, findings):
    store.store_episode(...)
    facts = extract_semantic_facts(...)
    store.store_semantic_facts(...)
    patterns = extract_procedural_patterns(...)
    for p in patterns:
        store.store_procedure(p)

# In run_agent, after streaming:
persist_memory.delay(session_id, query, synthesis, findings)
```

---

### 8. Observability & Monitoring

**Why:** Currently all exceptions are silently swallowed (`except: pass`).

**Add:**

```
┌─────────────────────────────────────────────────────────┐
│                    Observability Stack                   │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Structured  │  │   Metrics    │  │   Tracing     │  │
│  │ Logging     │  │  (Prometheus │  │ (OpenTelemetry│  │
│  │ (JSON to    │  │   /Datadog)  │  │  /LangSmith)  │  │
│  │  stdout)    │  │              │  │               │  │
│  └──────┬──────┘  └──────┬───────┘  └──────┬────────┘  │
│         │                │                 │           │
│         ▼                ▼                 ▼           │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Grafana / Datadog Dashboard           │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Key metrics to track:**

| Metric | Why |
|--------|-----|
| Query latency (p50, p95, p99) | User experience |
| Agent execution time per domain | Identify slow agents |
| Tool call success/failure rate | API health |
| LLM token usage per query | Cost control |
| Concurrent active queries | Capacity planning |
| Memory store read/write latency | DB health |
| External API error rates | Dependency health |
| Queue depth (if using Celery) | Backpressure signal |

```python
# Replace silent exceptions
# Current
except:
    pass

# Production
import structlog
logger = structlog.get_logger()

except Exception as e:
    logger.error("memory_store_failed", error=str(e), session_id=session_id)
    metrics.increment("memory.store.error", tags={"type": type(e).__name__})
```

**LangSmith integration** (already have `LANGSMITH_API_KEY`):
- Traces every LLM call, tool invocation, and agent step
- Built-in cost tracking per query
- Debugging failed agent runs

---

### 9. Secret Management

**Why:** API keys are in a `.env` file. If the repo leaks, all services are compromised.

**Production:**

| Environment | Solution |
|-------------|----------|
| AWS | AWS Secrets Manager or SSM Parameter Store |
| GCP | Google Secret Manager |
| Azure | Azure Key Vault |
| Kubernetes | Sealed Secrets or External Secrets Operator |
| Generic | HashiCorp Vault |

```python
# Current
api_key = os.getenv("OPENAI_API_KEY")  # From .env file

# Production (AWS example)
import boto3
client = boto3.client("secretsmanager")
secret = client.get_secret_value(SecretId="growth-platform/openai")
api_key = json.loads(secret["SecretString"])["api_key"]
```

**Also:**
- Rotate keys on a schedule
- Per-user API keys for "bring your own key" model
- Audit log for key access
- `.env` in `.gitignore` (ensure it's not committed)

---

### 10. Deployment Infrastructure

**Recommended: Containerized on Kubernetes or managed containers**

```
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Deployment: api (3 replicas)                        │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │ FastAPI  │  │ FastAPI  │  │ FastAPI  │          │   │
│  │  │ Pod 1    │  │ Pod 2    │  │ Pod 3    │          │   │
│  │  │ 2 CPU    │  │ 2 CPU    │  │ 2 CPU    │          │   │
│  │  │ 4GB RAM  │  │ 4GB RAM  │  │ 4GB RAM  │          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Deployment: worker (2 replicas)                     │   │
│  │  ┌──────────┐  ┌──────────┐                         │   │
│  │  │ Celery   │  │ Celery   │  (memory extraction,   │   │
│  │  │ Worker 1 │  │ Worker 2 │   artifact generation)  │   │
│  │  └──────────┘  └──────────┘                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │ PostgreSQL │  │   Redis    │  │  Qdrant    │           │
│  │ (managed)  │  │ (managed)  │  │ (managed)  │           │
│  └────────────┘  └────────────┘  └────────────┘           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Ingress Controller (nginx)                          │   │
│  │  ├── TLS termination                                │   │
│  │  ├── Rate limiting                                  │   │
│  │  └── WebSocket/SSE support                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  HPA: Auto-scale API pods based on CPU/concurrent queries  │
└─────────────────────────────────────────────────────────────┘
```

**Simpler alternative for early production:**

```
┌─────────────────────────────────────────────┐
│  Railway / Render / Fly.io                  │
│                                             │
│  ┌──────────────┐  ┌─────────────────────┐ │
│  │ FastAPI       │  │ Managed Services    │ │
│  │ (2-3 replicas)│  │ • Neon (PostgreSQL) │ │
│  │ + Gunicorn    │  │ • Upstash (Redis)   │ │
│  │ + Uvicorn     │  │ • Qdrant Cloud      │ │
│  └──────────────┘  └─────────────────────┘ │
│                                             │
│  Frontend: Vercel (Next.js)                 │
└─────────────────────────────────────────────┘
```

---

### 11. Frontend Changes

| Change | Why |
|--------|-----|
| Replace `http://localhost:8000` with env variable | Deploy to different domains |
| Add authentication UI (login/signup) | Multi-user support |
| Add loading states for auth | UX |
| WebSocket fallback for SSE | Some proxies break SSE |
| Error boundary components | Graceful failure |
| Service worker for offline caching | PWA support |
| CDN for static assets | Performance |

```typescript
// Current (hardcoded in useChat.ts, ModelSelector.tsx, useSessions.ts)
const API_URL = "http://localhost:8000/api/query";

// Production
const API_URL = process.env.NEXT_PUBLIC_API_URL + "/api/query";
```

---

### 12. Cost Control

Each query currently costs approximately:

| Component | Tokens/Calls | Est. Cost |
|-----------|-------------|-----------|
| Orchestrator (GPT-4o-mini) | ~2K tokens | $0.001 |
| 6 Specialist Agents (GPT-4o-mini) | ~12K tokens | $0.006 |
| Synthesis (GPT-4o-mini) | ~4K tokens | $0.002 |
| Artifact extraction (x3-5) | ~8K tokens | $0.004 |
| Follow-up generation | ~1K tokens | $0.0005 |
| Memory extraction | ~4K tokens | $0.002 |
| Serper API calls (6-10) | — | $0.01 |
| **Total per query** | | **~$0.03** |

**At scale (1000 queries/day):** ~$30/day = ~$900/month

**Cost controls to implement:**
- Token budgets per query (cap at 50K tokens)
- Caching identical/similar queries (Redis, 1hr TTL)
- Tiered model selection (nano for simple queries, full for complex)
- Per-user spending limits
- Alert on cost anomalies

---

## Priority Order for Implementation

### Phase 1: Essentials (Before First External User)

| # | Change | Effort | Impact |
|---|--------|--------|--------|
| 1 | Authentication (Clerk/Auth0) | 2-3 days | Security |
| 2 | PostgreSQL migration | 2-3 days | Multi-instance |
| 3 | Environment variables for URLs | 1 hour | Deployability |
| 4 | Secret management (.env → vault) | 1 day | Security |
| 5 | CORS restrict to actual domain | 10 min | Security |
| 6 | Basic structured logging | 1 day | Observability |
| 7 | Rate limiting (simple) | 1 day | Cost/abuse prevention |

### Phase 2: Scale (10-100 Concurrent Users)

| # | Change | Effort | Impact |
|---|--------|--------|--------|
| 8 | Redis caching layer | 2 days | Performance |
| 9 | Connection pooling (HTTP, DB) | 1-2 days | Resource efficiency |
| 10 | Playwright browser pool | 1 day | Memory usage |
| 11 | Background task queue (Celery) | 2-3 days | Response latency |
| 12 | Graph compilation cache | 1 hour | CPU usage |
| 13 | Qdrant/pgvector migration | 2-3 days | Vector DB scalability |

### Phase 3: Production Grade (100+ Users)

| # | Change | Effort | Impact |
|---|--------|--------|--------|
| 14 | Kubernetes deployment | 3-5 days | Auto-scaling |
| 15 | OpenTelemetry tracing | 2-3 days | Deep observability |
| 16 | Cost tracking per user | 2 days | Business model |
| 17 | Session TTL/cleanup | 1 day | Storage management |
| 18 | WebSocket fallback | 2 days | Reliability |
| 19 | Multi-region deployment | 3-5 days | Global latency |

---

## Summary of All Changes

| Area | Current | Production |
|------|---------|-----------|
| **Database** | SQLite (file) | PostgreSQL (managed) |
| **Vector DB** | ChromaDB (file) | Qdrant Cloud / pgvector |
| **Cache** | None | Redis |
| **Auth** | None | JWT + Clerk/Auth0 |
| **Secrets** | .env file | AWS Secrets Manager / Vault |
| **Rate Limiting** | None | Redis-based per-user |
| **Task Queue** | Inline | Celery + Redis |
| **HTTP Clients** | New per call | Pooled, shared |
| **Browser** | New per scrape | Browser pool (max 5) |
| **Graph** | Rebuilt per request | Compiled once, cached |
| **Logging** | `except: pass` | Structured JSON + metrics |
| **Tracing** | None | OpenTelemetry / LangSmith |
| **Deployment** | `uvicorn` local | K8s / Railway + Gunicorn |
| **Frontend** | localhost URLs | Environment variables |
| **CORS** | `*` (all origins) | Specific domains only |
| **Cost** | Untracked | Per-user budgets + alerts |
