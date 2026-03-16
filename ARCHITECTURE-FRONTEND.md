# Frontend Architecture — Growth Intelligence Platform

## Overview

Next.js 16 + React 19 + TypeScript application with real-time SSE streaming, session management, and interactive data visualization.

```
frontend/
├── app/
│   ├── layout.tsx                  # Root layout with metadata
│   ├── page.tsx                    # Main page (client component)
│   ├── globals.css                 # Tailwind + scrollbar styles
│   ├── components/
│   │   ├── ChatMessage.tsx         # Renders messages with markdown
│   │   ├── AgentStatusPanel.tsx    # Agent activity visualization
│   │   ├── SessionSidebar.tsx      # Chat history sidebar
│   │   ├── StarterChips.tsx        # Initial prompt suggestions
│   │   ├── FollowUpChips.tsx       # Follow-up question buttons
│   │   ├── ExportButtons.tsx       # Markdown & PDF export
│   │   ├── SourcesList.tsx         # Sources with credibility scoring
│   │   ├── ModelSelector.tsx       # LLM model switcher dropdown
│   │   ├── ComparisonBanner.tsx    # Comparison mode indicator
│   │   ├── ComparisonView.tsx      # Side-by-side entity comparison
│   │   └── artifacts/
│   │       ├── ArtifactRenderer.tsx     # Main artifact dispatcher
│   │       ├── CompetitorCards.tsx      # Expandable competitor cards
│   │       ├── TrendChart.tsx           # Recharts bar chart
│   │       ├── PricingTable.tsx         # Pricing comparison table
│   │       ├── SentimentScorecard.tsx   # Score visualization
│   │       └── MessagingMatrix.tsx      # Positioning vs perception
│   └── hooks/
│       ├── useChat.ts              # Main chat + SSE streaming
│       ├── useSessions.ts          # Session CRUD
│       └── useTypewriter.ts        # Text animation hook
└── package.json
```

---

## Component Tree

```
<Home> (page.tsx)
├── <SessionSidebar>
│   ├── "New Chat" button
│   └── Session list with delete buttons
│
├── Main Layout
│   ├── Header ("Growth Intelligence Platform")
│   │
│   ├── Messages Area
│   │   ├── <StarterChips>                        (if no messages)
│   │   └── For each message:
│   │       ├── <ComparisonBanner>                 (if comparison mode)
│   │       ├── <ComparisonView>                   (if comparison + complete)
│   │       │   ├── Executive Summary card
│   │       │   ├── Head-to-Head Comparison table
│   │       │   ├── Strengths & Weaknesses grid
│   │       │   ├── Verdict card
│   │       │   ├── Confidence Assessment
│   │       │   └── <SourcesList>
│   │       ├── <ChatMessage>                      (normal mode)
│   │       │   ├── User message (blue bubble)
│   │       │   ├── Assistant message (typewriter)
│   │       │   └── <SourcesList>
│   │       ├── <AgentStatusPanel>                 (while agents active)
│   │       │   └── Expandable run steps per agent
│   │       ├── <ArtifactRenderer>                 (if artifacts)
│   │       │   ├── <CompetitorCards>
│   │       │   ├── <TrendChart>
│   │       │   ├── <PricingTable>
│   │       │   ├── <SentimentScorecard>
│   │       │   └── <MessagingMatrix>
│   │       ├── <ExportButtons>                    (after response)
│   │       └── <FollowUpChips>                    (after response)
│   │
│   └── Input Area
│       ├── Text input field
│       ├── <ModelSelector> dropdown
│       └── Send button
```

---

## Hooks (State Management)

### useChat — Core Chat Hook

**State:**

```
messages: Message[]                              # Chat history
isLoading: boolean                               # Request in progress
agentStatuses: AgentStatus[]                     # Real-time agent updates
runSteps: RunStep[]                              # Agent tool call chain
artifacts: Artifact[]                            # Generated visualizations
artifactSuggestions: ArtifactSuggestions | null   # Pending artifacts
followUpQuestions: string[]                      # Suggested next questions
comparisonMode: { enabled, entities[] }          # Compare X vs Y state
selectedModel: string                            # Selected LLM model
sessionId: string | null                         # Current session
```

**Functions:**

| Function          | Description                                     |
|-------------------|-------------------------------------------------|
| `sendMessage()`   | POST to /api/query, handle SSE stream, update state |
| `startNewSession()`| Clear all state for new chat                   |
| `loadSession()`   | Fetch & restore previous session (messages, artifacts, agents, steps) |

### useSessions — Session Management

```
sessions: Session[]           # Session list
loading: boolean              # Fetch in progress
refresh()                     # Re-fetch sessions
deleteSession(id)             # DELETE + optimistic removal
```

### useTypewriter — Text Animation

```
useTypewriter(fullText, enabled, charsPerTick=8, intervalMs=12) → string
```

- Gradually reveals text at 8 chars per 12ms tick
- Disabled for loaded sessions (instant render)
- Cleans up interval on unmount

---

## SSE Streaming Flow

```
User Input (page.tsx)
       │
       ▼
handleSubmit() → sendMessage(query)
       │
       ▼
fetch POST /api/query
  {query, conversation_history, session_id, model}
       │
       ▼
ReadableStream → TextDecoder → parse "data: {JSON}" lines
       │
       ▼
switch(event):
  ├── "agent_status"        → Update agent card in AgentStatusPanel
  ├── "run_step"            → Append to chain-of-thought display
  ├── "artifact_suggestions"→ Show loading artifact cards
  ├── "artifact"            → Render completed artifact component
  ├── "synthesis"           → Update assistant message content
  │                           (triggers typewriter animation)
  │                           If comparison: set comparisonMode
  ├── "followup_questions"  → Show follow-up chips
  ├── "error"               → Display error in chat
  └── "done"                → Set sessionId, isLoading=false
```

---

## Component Details

### ChatMessage

- Renders user (blue bubble) and assistant (dark bubble) messages
- Markdown rendering via `react-markdown` + `remark-gfm`
- Extracts `## Sources` section, renders separately via `<SourcesList>`
- Typewriter animation via `useTypewriter` hook when `streaming=true`

### AgentStatusPanel

- Collapsible panel showing all 6 agents
- Status icons: spinning (running), checkmark (complete), X (failed)
- Expandable run steps per agent:
  - `tool_call` (yellow) — tool name + input
  - `tool_result` (blue) — truncated output
  - `thought` (green) — agent reasoning
  - `error` (red) — failure message

### SourcesList

- Parses markdown: `- [title](url) \`tier\` \`score/5\``
- 5 credibility tiers with color-coded badges:
  - **Official** (5/5) — Building icon, blue
  - **Research** (4/5) — Flask icon, purple
  - **News** (3/5) — Newspaper icon, amber
  - **Community** (2/5) — Users icon, green
  - **Social** (1/5) — MessageCircle icon, zinc
- Dot-based score bar (1-5), sorted by credibility descending

### ComparisonView

- Activates when synthesis has `comparison: true`
- Parses markdown sections by `##` headings
- Renders structured cards:
  1. **Executive Summary** (blue, Target icon)
  2. **Head-to-Head Comparison** (amber, Zap icon)
  3. **Strengths & Weaknesses** (multi-column grid per entity)
  4. **Verdict** (indigo, Trophy icon)
  5. **Confidence Assessment** (gray, AlertTriangle icon)
  6. **Sources** (SourcesList component)
- Entity colors: blue, emerald, amber, purple

### ArtifactRenderer

- Shows pending artifacts with loading spinner
- Dispatches completed artifacts to specialized components:

| Artifact Type          | Component           | Visualization               |
|------------------------|---------------------|-----------------------------|
| `competitive_landscape`| CompetitorCards     | Expandable cards with features |
| `trend_chart`          | TrendChart          | Recharts horizontal bar chart |
| `pricing_table`        | PricingTable        | HTML table with tiers       |
| `sentiment_scorecard`  | SentimentScorecard  | Score cards with progress bars |
| `messaging_matrix`     | MessagingMatrix     | Official vs user perception grid |

### ExportButtons

- **Markdown export**: Downloads `.md` file with artifacts appended
- **PDF export** (jsPDF):
  - Processes markdown (headings, bullets, paragraphs)
  - Multi-page with pagination
  - Clickable blue hyperlinks in Sources appendix
  - Deduplicates sources by URL

### ModelSelector

- Fetches available models from `GET /api/models`
- Dropdown opens upward (bottom-full positioned)
- Shows current model label + Cpu icon
- Lists all models with provider info + active indicator dot

### SessionSidebar

- Fixed width 256px sidebar
- "New Chat" button at top
- Session list with relative timestamps
- Delete button (Trash2 icon, red on hover)
- Active session highlighted

### StarterChips

- Shown when message list is empty
- Pre-defined prompt suggestions to get started

### FollowUpChips

- 2-3 clickable follow-up question buttons with ArrowRight icon
- Triggers `sendMessage(question)` on click

---

## API Communication

| Method | Endpoint              | Payload                                      | Used By        |
|--------|-----------------------|----------------------------------------------|----------------|
| POST   | `/api/query`          | query, conversation_history, session_id, model | useChat        |
| GET    | `/api/sessions`       | —                                            | useSessions    |
| GET    | `/api/sessions/{id}`  | —                                            | useChat        |
| DELETE | `/api/sessions/{id}`  | —                                            | useSessions    |
| GET    | `/api/models`         | —                                            | ModelSelector  |

Base URL: `http://localhost:8000`

---

## State Lifecycle Example

```
1. User types "What's my market position?"
   → messages=[], isLoading=false

2. Click send
   → messages=[userMsg], isLoading=true

3. SSE: agent_status events
   → agentStatuses=[{agent_id: "market_trend", status: "running"}...]

4. SSE: run_step events
   → runSteps=[{type: "tool_call", tool: "serper_search"...}...]

5. SSE: artifact_suggestions
   → UI shows loading artifact cards

6. SSE: artifact events
   → artifacts=[{type: "competitive_landscape", data: {...}}]

7. SSE: synthesis
   → Assistant message content populated, typewriter starts

8. SSE: followup_questions
   → Follow-up chips appear below response

9. SSE: done
   → isLoading=false, sessionId set, ExportButtons appear
```

---

## Tech Stack

```
next              16.1.6       # App Router, React Server Components
react             19.2.3       # UI framework
typescript        5.x          # Type safety
tailwindcss       4.x          # Utility-first CSS (dark theme)
lucide-react      —            # Icon library
react-markdown    —            # Markdown rendering
remark-gfm        —            # GitHub Flavored Markdown
recharts          —            # Data visualization (charts)
jspdf             —            # PDF generation
html2canvas       —            # HTML-to-canvas for exports
```
