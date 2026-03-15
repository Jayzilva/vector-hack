# Software Requirements Specification (SRS)

## Growth Intelligence Platform — Multi-Agent Conversational System

**Version:** 1.0
**Date:** 15 March 2026
**Event:** Veracity AI × Hatch Hackathon
**Build Window:** 3 Hours

---

## 1. Introduction

### 1.1 Purpose

This document defines the software requirements for a multi-agent conversational intelligence platform that delivers real-time growth intelligence to product teams through a single chat interface. The system replaces the manual process of synthesising insights from 16+ tools by orchestrating specialised AI agents that research, analyse, and present findings as interactive inline artifacts.

### 1.2 Scope

The application is a web-based conversational interface backed by a multi-agent orchestration engine. A user asks a strategic growth question in natural language. The system decomposes the question, dispatches parallel research agents across live data sources, synthesises findings with confidence scoring, and renders results as interactive UI components within the conversation thread.

### 1.3 Target Users

- Product managers evaluating market positioning
- Growth teams assessing competitive landscape
- Strategy leads preparing board-level intelligence briefs

### 1.4 Constraints

- 3-hour build window — prioritise working demo over feature completeness
- Free-tier APIs only — no paid subscriptions required
- Must demonstrate against Vector Agents (vectoragents.ai) and generalise to at least one other product
- Must show agent coordination, not a single prompt-response wrapper

---

## 2. System Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js / React)            │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Chat Input   │  │ Agent Status │  │ Inline Artifacts│  │
│  │ & Thread     │  │ Panel        │  │ (Charts/Tables) │  │
│  └─────────────┘  └──────────────┘  └────────────────┘  │
└──────────────────────────┬──────────────────────────────┘
                           │ WebSocket / SSE
┌──────────────────────────▼──────────────────────────────┐
│                 ORCHESTRATOR AGENT                        │
│         (Query Decomposition & Task Routing)              │
└───┬──────┬──────┬──────┬──────┬──────┬──────────────────┘
    │      │      │      │      │      │
    ▼      ▼      ▼      ▼      ▼      ▼
┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐
│Market││Compet││Win/  ││Price ││Posit-││Adjac-│
│Trend ││itive ││Loss  ││Intel ││ioning││ent   │
│Agent ││Agent ││Agent ││Agent ││Agent ││Market│
└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘
   │       │       │       │       │       │
   ▼       ▼       ▼       ▼       ▼       ▼
┌─────────────────────────────────────────────────────────┐
│                   DATA SOURCE LAYER                      │
│  SerpAPI · Firecrawl · Meta Ad Library · Reddit API      │
│  HN Algolia · USPTO Patents · Playwright (fallback)      │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Justification |
|---|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS | Fast scaffolding, SSR, streaming support |
| LLM Backbone | Claude API (claude-sonnet-4-20250514) with tool use | Native tool calling, structured output, MCP support |
| Agent Framework | Custom orchestrator using Claude tool-use loop | Lightweight, hackathon-appropriate, no heavy framework |
| Web Scraping | Firecrawl (MCP server) | 500 free credits, returns LLM-ready markdown |
| Search Data | SerpAPI (free tier) | Google Trends, News, Ads as structured JSON |
| Ad Intelligence | Meta Ad Library API | Free, structured JSON, political + EU ads |
| Community Signal | Reddit API (OAuth2) + HN Algolia | Free, real user voice and developer sentiment |
| Fallback Scraper | Playwright | For JS-heavy sites with no API |
| Streaming | Server-Sent Events (SSE) | Real-time agent status and response streaming |

---

## 3. Functional Requirements

### 3.1 Conversational Interface (FR-01)

**FR-01.1** — The system shall provide a single-page chat interface where the user types natural language questions.

**FR-01.2** — The system shall display streamed responses in real time as agents complete their work.

**FR-01.3** — The system shall maintain conversational memory within a session — follow-up questions build on prior context.

**FR-01.4** — The system shall offer pre-built "starter" query chips for demo convenience:
- "Is Vector Agents competitive in the AI SDR market right now?"
- "Is the digital workers category accelerating or consolidating?"
- "What should Vector Agents build or reposition over the next six months?"

### 3.2 Query Decomposition & Orchestration (FR-02)

**FR-02.1** — The Orchestrator Agent shall receive the user's question and decompose it into sub-tasks mapped to one or more of the six intelligence domains:

| Domain | Agent Responsibility |
|---|---|
| Market & Trend Sensing | Category trajectory, leading indicators, search trends |
| Competitive Landscape | Competitor identification, feature comparison, funding signals |
| Win/Loss Intelligence | Review sentiment, buyer objections, churn signals |
| Pricing & Packaging | Pricing model analysis, willingness-to-pay signals |
| Positioning & Messaging | How competitors talk about themselves vs. user perception |
| Adjacent Market Collision | Threats from outside the core category |

**FR-02.2** — The Orchestrator shall dispatch relevant specialist agents in parallel, not sequentially.

**FR-02.3** — The Orchestrator shall track agent lifecycle states: `spawned → researching → synthesising → complete → failed`.

**FR-02.4** — The Orchestrator shall handle agent failure gracefully — if one agent fails, the system still returns partial results from successful agents with a note about the gap.

### 3.3 Specialist Agents (FR-03)

Each specialist agent shall:

**FR-03.1** — Execute one or more tool calls to retrieve live data from external sources.

**FR-03.2** — Perform multi-hop research where needed — initial search → deepen promising leads → cross-reference → surface findings.

**FR-03.3** — Return structured output in the following schema:

```json
{
  "agent_id": "market_trend_agent",
  "domain": "Market & Trend Sensing",
  "status": "complete",
  "confidence": "high | medium | low",
  "findings": [
    {
      "type": "fact | interpretation",
      "claim": "The AI SDR market grew 40% YoY in 2025.",
      "source": "https://example.com/report",
      "confidence": "high",
      "retrieved_at": "2026-03-15T10:23:00Z"
    }
  ],
  "summary": "Short synthesis paragraph."
}
```

**FR-03.4** — Clearly separate facts (sourced data points) from interpretations (agent-generated analysis).

### 3.4 Data Source Integration (FR-04)

**FR-04.1 — Firecrawl (Primary)**
- Scrape any URL to LLM-ready markdown
- Use for competitor product pages, blog posts, documentation
- 500 free credits available

**FR-04.2 — SerpAPI**
- Google Search, Google Trends, Google News
- 100 free searches/month
- Use for market signals, trend data, news mentions

**FR-04.3 — Meta Ad Library API**
- Competitor ad creatives, spend ranges, demographics
- Free with identity verification
- Use for positioning and messaging analysis

**FR-04.4 — Reddit API (OAuth2)**
- Subreddit search for product mentions, complaints, praise
- Free tier sufficient
- Use for win/loss intelligence and user sentiment

**FR-04.5 — HN Algolia API**
- Search Hacker News posts and comments
- Free, no API key required
- Use for developer sentiment and tech community buzz

**FR-04.6 — Playwright (Fallback)**
- Browser automation for JS-heavy sites without APIs
- Use for BigSpy, Google Ads Transparency, LinkedIn Ad Library

### 3.5 Inline Artifact Rendering (FR-05)

**FR-05.1** — The system shall render findings as interactive UI components inside the chat thread, not as plain text or external links.

**FR-05.2** — Required artifact types:

| Artifact | Use Case | Minimum Implementation |
|---|---|---|
| Competitive Landscape Map | Show players, positioning, funding | Interactive card grid or bubble chart |
| Trend Chart | Category growth, search interest over time | Line/area chart (Recharts or Chart.js) |
| Pricing Comparison Table | Side-by-side pricing tiers | Sortable/filterable table |
| Sentiment Scorecard | Win/loss signals from reviews & forums | Colour-coded score cards with source links |
| Messaging Gap Matrix | Positioning vs. perception alignment | Heatmap or comparison matrix |
| Source Trail Panel | All sources with confidence badges | Expandable list with timestamps |

**FR-05.3** — Each artifact shall be interactive — at minimum, clickable to expand or drill down.

**FR-05.4** — Each artifact shall display a confidence indicator (high/medium/low) and link to underlying sources.

### 3.6 Agent Status Visibility (FR-06)

**FR-06.1** — The UI shall display a real-time panel showing which agents are active, their current state, and what data source they are querying.

**FR-06.2** — Status updates shall stream to the frontend via SSE as agents progress through lifecycle states.

**FR-06.3** — Completed agents shall show a summary chip that can be expanded for detail.

### 3.7 Conversational Memory (FR-07)

**FR-07.1** — The system shall maintain a session-level conversation history.

**FR-07.2** — Follow-up queries shall have access to all prior findings — the user should not need to re-explain context.

**FR-07.3** — New research results shall update prior conclusions when contradictory evidence is found.

---

## 4. Non-Functional Requirements

### 4.1 Performance

**NFR-01** — First visible agent status update shall appear within 3 seconds of query submission.

**NFR-02** — Full synthesis response shall complete within 60–90 seconds for a standard query.

**NFR-03** — Parallel agent execution shall reduce total time compared to sequential execution by at least 50%.

### 4.2 Reliability

**NFR-04** — The system shall degrade gracefully — a failed data source shall not crash the entire response.

**NFR-05** — Each agent shall have a 30-second timeout with automatic fallback messaging.

### 4.3 Scalability Considerations

**NFR-06** — The architecture shall document a path to horizontal scaling (e.g., agent workers as serverless functions).

**NFR-07** — The system shall estimate and display cost-per-query (LLM tokens + API calls) for GTM viability.

### 4.4 Security

**NFR-08** — API keys shall be stored as environment variables, never hardcoded or exposed to the client.

**NFR-09** — All external API calls shall be made server-side only.

---

## 5. Build Plan — 3-Hour Sprint

### Phase 1: Foundation (0:00 – 0:45)

| Task | Time | Output |
|---|---|---|
| Project scaffold (Next.js + Tailwind) | 10 min | Running dev server |
| Chat UI — input box, message thread, streaming display | 20 min | Functional chat interface |
| Backend API route — `/api/chat` with SSE streaming | 15 min | Streaming endpoint |

### Phase 2: Agent Engine (0:45 – 1:45)

| Task | Time | Output |
|---|---|---|
| Orchestrator Agent — query decomposition via Claude tool use | 15 min | Routes questions to domains |
| Tool definitions — Firecrawl scrape, SerpAPI search, Reddit search | 15 min | Tools callable by agents |
| Specialist Agent loop — tool call → process → structured output | 20 min | Agents return findings |
| Parallel execution — Promise.all for concurrent agents | 10 min | Agents run simultaneously |

### Phase 3: Artifacts & Synthesis (1:45 – 2:30)

| Task | Time | Output |
|---|---|---|
| Synthesis Agent — merge findings, assign confidence, generate summary | 15 min | Unified intelligence brief |
| Inline artifact components — competitive table, trend chart, scorecard | 20 min | Rich UI in chat thread |
| Source trail panel with confidence badges | 10 min | Transparency layer |

### Phase 4: Polish & Demo Prep (2:30 – 3:00)

| Task | Time | Output |
|---|---|---|
| Agent status panel — live indicators | 10 min | Visible agent coordination |
| Starter query chips + loading states | 5 min | Demo-ready UX |
| Test with Vector Agents queries | 10 min | Validated demo scenario |
| Test generalisation with second product | 5 min | Proves generalisability |

---

## 6. Demo Script

### Demo Flow (10 minutes)

**Opening (1 min):** Briefly state the problem — growth intelligence takes weeks, scattered across 16+ tools.

**Live Query 1 (3 min):** Type "Is Vector Agents competitive in the AI SDR market right now?" Show agents spinning up, data flowing in, and the competitive landscape artifact rendering inline.

**Live Query 2 (2 min):** Follow up with "What should Vector Agents build or reposition over the next six months?" Show conversational memory in action — no re-explanation needed.

**Generalisation (2 min):** Switch to a different product entirely (e.g., a fintech or e-commerce tool) and ask a growth question. Show the system works beyond Vector Agents.

**Architecture Walkthrough (2 min):** Briefly show the agent status panel, explain the multi-agent coordination, point out confidence scoring and source trails. Emphasise that this is not a single LLM call.

---

## 7. Evaluation Alignment

| Criterion (Weight) | How This SRS Addresses It |
|---|---|
| Core Algorithm — Multi-Agent System (25%) | 6 specialist agents + 1 orchestrator + 1 synthesis agent, parallel execution, lifecycle management, tool/MCP usage |
| Product Design Strategy (25%) | Inline interactive artifacts, agent status panel, starter chips, streaming UX |
| Intelligence Quality & Grounding (20%) | Multi-source data, confidence scores, fact vs. interpretation separation, source trails |
| Scalability & Cost Efficiency (15%) | Serverless-ready architecture, cost-per-query estimation, free-tier APIs |
| Demo Strength & Generalisability (15%) | Scripted demo with Vector Agents + second product, conversational memory shown |

---

## 8. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| API rate limits hit during demo | Agent returns no data | Cache demo queries; implement graceful fallback messaging |
| Firecrawl credits exhausted | Cannot scrape live pages | Pre-cache key URLs; use Playwright as backup |
| Claude API latency spikes | Slow response times | Stream partial results; show agent progress to maintain engagement |
| Agent returns hallucinated data | Low intelligence quality | Enforce structured output schema; validate all claims have source URLs |
| 3-hour time overrun | Incomplete features | Build in priority order — Phase 1 & 2 are non-negotiable; Phase 3 & 4 are enhancers |

---

## 9. Glossary

| Term | Definition |
|---|---|
| Agent | An autonomous LLM-powered unit with a specific research scope and set of tools |
| Artifact | An interactive UI component rendered inline within the conversation |
| Confidence Score | A rating (high/medium/low) indicating the reliability of a finding |
| Intelligence Domain | One of the six strategic areas the system must cover |
| MCP | Model Context Protocol — allows Claude to directly use external tools like Firecrawl |
| Multi-hop Research | A research pattern where initial findings lead to deeper follow-up queries |
| Orchestrator | The central agent that decomposes queries and coordinates specialist agents |
| SSE | Server-Sent Events — a protocol for streaming real-time updates from server to client |

---

*End of SRS — Version 1.0*
