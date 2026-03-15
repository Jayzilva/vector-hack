import json
import os
from datetime import datetime, timezone
from typing import AsyncGenerator

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import create_react_agent
from langgraph.types import Send

from app.memory.store import MemoryStore
from app.prompts import (
    AGENT_DOMAINS,
    AGENT_PROMPTS,
    ARTIFACT_EXTRACT_PROMPTS,
    ARTIFACT_SUGGEST_PROMPT,
    ARTIFACT_TITLES,
    ORCHESTRATOR_PROMPT,
    SYNTHESIS_PROMPT,
)
from app.state import GraphState
from app.tools import (
    ADJACENT_MARKET_TOOLS,
    COMPETITIVE_TOOLS,
    MARKET_TREND_TOOLS,
    POSITIONING_TOOLS,
    PRICING_TOOLS,
    WIN_LOSS_TOOLS,
)

AGENT_TOOL_MAP = {
    "market_trend_agent": MARKET_TREND_TOOLS,
    "competitive_agent": COMPETITIVE_TOOLS,
    "win_loss_agent": WIN_LOSS_TOOLS,
    "pricing_agent": PRICING_TOOLS,
    "positioning_agent": POSITIONING_TOOLS,
    "adjacent_market_agent": ADJACENT_MARKET_TOOLS,
}


def _get_llm():
    return ChatOpenAI(
        model="gpt-4o-mini",
        api_key=os.getenv("OPENAI_API_KEY"),
        max_tokens=4096,
    )


# ---------------------------------------------------------------------------
# Node: Memory Retrieval — search all 3 memory types for relevant context
# ---------------------------------------------------------------------------
async def memory_retrieval_node(state: GraphState) -> dict:
    store = MemoryStore()
    query = state["query"]

    semantic = store.search_semantic(query, n_results=5)
    episodic = store.search_episodes(query, n_results=3)
    procedural = store.search_procedures(query, n_results=3)

    return {
        "memory_context": {
            "semantic_facts": [f["content"] for f in semantic],
            "episodic_summaries": [e["summary"] for e in episodic],
            "procedural_hints": [p["description"] for p in procedural],
        }
    }


# ---------------------------------------------------------------------------
# Node: Orchestrator — decomposes query into sub-tasks (memory-augmented)
# ---------------------------------------------------------------------------
async def orchestrator_node(state: GraphState) -> dict:
    llm = _get_llm()

    messages = [
        SystemMessage(content=ORCHESTRATOR_PROMPT),
    ]

    # Inject memory context
    memory = state.get("memory_context", {})
    if memory.get("semantic_facts"):
        messages.append(HumanMessage(
            content="Relevant facts from previous research:\n"
            + "\n".join(f"- {f}" for f in memory["semantic_facts"])
        ))
    if memory.get("episodic_summaries"):
        messages.append(HumanMessage(
            content="Relevant past research sessions:\n"
            + "\n".join(f"- {s}" for s in memory["episodic_summaries"])
        ))
    if memory.get("procedural_hints"):
        messages.append(HumanMessage(
            content="Research approach hints from past experience:\n"
            + "\n".join(f"- {h}" for h in memory["procedural_hints"])
        ))

    if state.get("conversation_history"):
        context = "\n".join(
            f"{msg['role']}: {msg['content']}"
            for msg in state["conversation_history"][-6:]
        )
        messages.append(HumanMessage(content=f"Previous conversation context:\n{context}"))

    messages.append(HumanMessage(content=state["query"]))

    response = await llm.ainvoke(messages)

    try:
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0]
        tasks = json.loads(content)
        decomposed = tasks.get("tasks", [])
    except (json.JSONDecodeError, AttributeError):
        decomposed = [
            {"agent_id": "market_trend_agent", "task": state["query"]},
            {"agent_id": "competitive_agent", "task": state["query"]},
            {"agent_id": "win_loss_agent", "task": state["query"]},
            {"agent_id": "pricing_agent", "task": state["query"]},
            {"agent_id": "positioning_agent", "task": state["query"]},
            {"agent_id": "adjacent_market_agent", "task": state["query"]},
        ]

    return {"decomposed_tasks": decomposed}


# ---------------------------------------------------------------------------
# Node: Specialist Agent — runs a ReAct agent with chain-of-thought capture
# ---------------------------------------------------------------------------
async def specialist_agent_node(state: GraphState) -> dict:
    task_info = state["decomposed_tasks"][0]
    agent_id = task_info["agent_id"]
    task = task_info["task"]

    tools = AGENT_TOOL_MAP.get(agent_id, MARKET_TREND_TOOLS)
    prompt_template = AGENT_PROMPTS.get(agent_id, "{task}")
    domain = AGENT_DOMAINS.get(agent_id, "Research")

    llm = _get_llm()
    agent = create_react_agent(llm, tools)

    system_prompt = prompt_template.format(task=task)
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=task),
    ]

    run_history: list[dict] = []

    try:
        async for event in agent.astream_events(
            {"messages": messages}, version="v2"
        ):
            kind = event.get("event", "")
            ts = datetime.now(timezone.utc).isoformat()

            if kind == "on_chat_model_stream":
                chunk = event.get("data", {}).get("chunk")
                if chunk and hasattr(chunk, "tool_call_chunks"):
                    for tc in chunk.tool_call_chunks:
                        if tc.get("name"):
                            run_history.append({
                                "type": "tool_call",
                                "agent_id": agent_id,
                                "tool": tc["name"],
                                "input": tc.get("args", ""),
                                "timestamp": ts,
                            })

            if kind == "on_tool_end":
                tool_name = event.get("name", "")
                output = str(event.get("data", {}).get("output", ""))
                run_history.append({
                    "type": "tool_result",
                    "agent_id": agent_id,
                    "tool": tool_name,
                    "output": output[:500],
                    "timestamp": ts,
                })

            if kind == "on_chat_model_end":
                output = event.get("data", {}).get("output")
                if output and hasattr(output, "content") and isinstance(output.content, str) and output.content.strip():
                    if not (hasattr(output, "tool_calls") and output.tool_calls and not output.content.strip()):
                        run_history.append({
                            "type": "thought",
                            "agent_id": agent_id,
                            "content": output.content[:1000],
                            "timestamp": ts,
                        })

        summary = ""
        for entry in reversed(run_history):
            if entry["type"] == "thought":
                summary = entry["content"]
                break

        if not summary:
            summary = "Agent completed but produced no text output."

        return {
            "agent_findings": [
                {
                    "agent_id": agent_id,
                    "domain": domain,
                    "status": "complete",
                    "confidence": "medium",
                    "findings": [],
                    "summary": summary,
                    "run_history": run_history,
                }
            ]
        }
    except Exception as e:
        run_history.append({
            "type": "error",
            "agent_id": agent_id,
            "content": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return {
            "agent_findings": [
                {
                    "agent_id": agent_id,
                    "domain": domain,
                    "status": "failed",
                    "confidence": "low",
                    "findings": [],
                    "summary": f"Agent failed: {str(e)}",
                    "run_history": run_history,
                }
            ]
        }


# ---------------------------------------------------------------------------
# Node: Synthesis — merges all agent findings
# ---------------------------------------------------------------------------
async def synthesis_node(state: GraphState) -> dict:
    llm = _get_llm()

    findings_text = ""
    for finding in state.get("agent_findings", []):
        findings_text += f"\n\n## {finding['domain']} ({finding['agent_id']})\n"
        findings_text += f"Status: {finding['status']} | Confidence: {finding['confidence']}\n"
        findings_text += f"{finding['summary']}\n"

    prompt = SYNTHESIS_PROMPT.format(findings=findings_text)
    messages = [
        SystemMessage(content=prompt),
        HumanMessage(content=state["query"]),
    ]

    response = await llm.ainvoke(messages)
    return {"synthesis": response.content}


# ---------------------------------------------------------------------------
# Artifact generation helpers
# ---------------------------------------------------------------------------
async def suggest_artifacts(findings_text: str) -> list[str]:
    llm = _get_llm()
    prompt = ARTIFACT_SUGGEST_PROMPT.format(findings=findings_text)
    try:
        response = await llm.ainvoke([
            SystemMessage(content=prompt),
            HumanMessage(content="Which artifacts can be generated?"),
        ])
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0]
        data = json.loads(content)
        suggested = data.get("artifacts", [])
        valid = set(ARTIFACT_EXTRACT_PROMPTS.keys())
        return [a for a in suggested if a in valid]
    except Exception:
        return list(ARTIFACT_EXTRACT_PROMPTS.keys())


async def extract_single_artifact(artifact_type: str, findings_text: str) -> dict | None:
    llm = _get_llm()
    prompt_template = ARTIFACT_EXTRACT_PROMPTS.get(artifact_type)
    if not prompt_template:
        return None

    prompt = prompt_template.format(findings=findings_text)
    try:
        response = await llm.ainvoke([
            SystemMessage(content=prompt),
            HumanMessage(content="Extract the data now."),
        ])
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0]
        extracted = json.loads(content)
        title = ARTIFACT_TITLES.get(artifact_type, artifact_type.replace("_", " ").title())

        if artifact_type == "competitive_landscape":
            if isinstance(extracted, list) and len(extracted) > 0:
                return {"type": artifact_type, "title": title, "data": {"title": title, "competitors": extracted}}
        elif artifact_type == "trend_chart":
            if isinstance(extracted, dict) and extracted.get("signals"):
                return {"type": artifact_type, "title": title, "data": {"title": title, **extracted}}
        elif artifact_type == "pricing_table":
            if isinstance(extracted, list) and len(extracted) > 0:
                return {"type": artifact_type, "title": title, "data": {"title": title, "competitors": extracted}}
        elif artifact_type == "sentiment_scorecard":
            if isinstance(extracted, list) and len(extracted) > 0:
                return {"type": artifact_type, "title": title, "data": {"title": title, "scores": extracted}}
        elif artifact_type == "messaging_matrix":
            if isinstance(extracted, list) and len(extracted) > 0:
                return {"type": artifact_type, "title": title, "data": {"title": title, "competitors": extracted}}
        return None
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Conditional edge: fan-out to specialist agents in parallel
# ---------------------------------------------------------------------------
def route_to_agents(state: GraphState) -> list[Send]:
    tasks = state.get("decomposed_tasks", [])
    sends = []
    for task in tasks:
        agent_id = task.get("agent_id", "")
        if agent_id in AGENT_TOOL_MAP:
            sends.append(
                Send("specialist_agent", {**state, "decomposed_tasks": [task]})
            )
    if not sends:
        sends.append(
            Send("specialist_agent", {
                **state,
                "decomposed_tasks": [{"agent_id": "market_trend_agent", "task": state["query"]}],
            })
        )
    return sends


# ---------------------------------------------------------------------------
# Build the LangGraph state graph
# ---------------------------------------------------------------------------
def build_graph():
    graph = StateGraph(GraphState)

    graph.add_node("memory_retrieval", memory_retrieval_node)
    graph.add_node("orchestrator", orchestrator_node)
    graph.add_node("specialist_agent", specialist_agent_node)
    graph.add_node("synthesis", synthesis_node)

    graph.add_edge(START, "memory_retrieval")
    graph.add_edge("memory_retrieval", "orchestrator")
    graph.add_conditional_edges("orchestrator", route_to_agents, ["specialist_agent"])
    graph.add_edge("specialist_agent", "synthesis")
    graph.add_edge("synthesis", END)

    return graph.compile()


# ---------------------------------------------------------------------------
# Run agent with SSE event streaming + memory persistence
# ---------------------------------------------------------------------------
async def run_agent(
    query: str,
    conversation_history: list[dict] | None = None,
    session_id: str | None = None,
) -> AsyncGenerator[str, None]:
    """Run the multi-agent graph and yield SSE event strings."""
    graph = build_graph()
    store = MemoryStore()

    # Create or reuse session
    if not session_id:
        session_id = store.create_session()

    initial_state = {
        "query": query,
        "session_id": session_id,
        "conversation_history": conversation_history or [],
        "messages": [],
        "decomposed_tasks": [],
        "agent_findings": [],
        "synthesis": "",
        "memory_context": {},
    }

    yield _sse_event("agent_status", {
        "agent_id": "memory",
        "status": "spawned",
        "message": "Searching memory for relevant context...",
    })

    try:
        completed_agents: set[str] = set()
        synthesis_result = ""
        agent_findings_count = 0
        all_findings: list[dict] = []

        async for chunk in graph.astream(initial_state, stream_mode="updates"):
            for node_name, node_output in chunk.items():

                # Memory retrieval completed
                if node_name == "memory_retrieval":
                    ctx = node_output.get("memory_context", {})
                    sem_count = len(ctx.get("semantic_facts", []))
                    epi_count = len(ctx.get("episodic_summaries", []))
                    proc_count = len(ctx.get("procedural_hints", []))
                    total = sem_count + epi_count + proc_count
                    if total > 0:
                        yield _sse_event("agent_status", {
                            "agent_id": "memory",
                            "status": "complete",
                            "message": f"Found {sem_count} facts, {epi_count} past sessions, {proc_count} patterns",
                        })
                        yield _sse_event("memory_context", {
                            "semantic_count": sem_count,
                            "episodic_count": epi_count,
                            "procedural_count": proc_count,
                            "semantic_facts": ctx.get("semantic_facts", [])[:3],
                            "episodic_summaries": ctx.get("episodic_summaries", [])[:2],
                        })
                    else:
                        yield _sse_event("agent_status", {
                            "agent_id": "memory",
                            "status": "complete",
                            "message": "No prior memories found — starting fresh",
                        })

                    yield _sse_event("agent_status", {
                        "agent_id": "orchestrator",
                        "status": "spawned",
                        "message": "Analyzing query and planning research...",
                    })

                # Orchestrator completed
                if node_name == "orchestrator":
                    tasks = node_output.get("decomposed_tasks", [])
                    if tasks:
                        yield _sse_event("agent_status", {
                            "agent_id": "orchestrator",
                            "status": "complete",
                            "message": f"Dispatching {len(tasks)} specialist agents",
                        })
                        for task in tasks:
                            aid = task.get("agent_id", "")
                            domain = AGENT_DOMAINS.get(aid, "Research")
                            yield _sse_event("agent_status", {
                                "agent_id": aid,
                                "status": "spawned",
                                "message": f"Starting {domain} research...",
                            })

                # Specialist agent completed
                if node_name == "specialist_agent":
                    findings = node_output.get("agent_findings", [])
                    for finding in findings:
                        aid = finding.get("agent_id", "")
                        completed_agents.add(aid)
                        agent_findings_count += 1
                        all_findings.append(finding)
                        status = finding.get("status", "complete")
                        domain = finding.get("domain", "")

                        for entry in finding.get("run_history", []):
                            yield _sse_event("run_step", entry)

                        yield _sse_event("agent_status", {
                            "agent_id": aid,
                            "status": status,
                            "message": f"{domain} analysis complete",
                        })
                        yield _sse_event("finding", {
                            "agent_id": aid,
                            "domain": domain,
                            "finding": finding.get("summary", "")[:500],
                        })

                # Synthesis completed
                if node_name == "synthesis":
                    synthesis_result = node_output.get("synthesis", "")
                    if synthesis_result:
                        yield _sse_event("agent_status", {
                            "agent_id": "synthesis",
                            "status": "complete",
                            "message": "Intelligence brief ready",
                        })

        # Emit synthesis
        if synthesis_result:
            yield _sse_event("synthesis", {
                "summary": synthesis_result,
                "confidence": "medium",
                "sources_count": agent_findings_count,
            })
        else:
            yield _sse_event("error", {"message": "No synthesis produced"})

        # Generate artifacts
        generated_artifacts: list[dict] = []
        if all_findings:
            findings_text = ""
            for f in all_findings:
                findings_text += f"\n\n## {f.get('domain', '')} ({f.get('agent_id', '')})\n"
                findings_text += f"{f.get('summary', '')}\n"

            yield _sse_event("agent_status", {
                "agent_id": "artifacts",
                "status": "spawned",
                "message": "Analyzing findings for artifact suggestions...",
            })
            suggested = await suggest_artifacts(findings_text)

            if suggested:
                yield _sse_event("artifact_suggestions", {
                    "suggested": suggested,
                    "titles": {s: ARTIFACT_TITLES.get(s, s) for s in suggested},
                })
                yield _sse_event("agent_status", {
                    "agent_id": "artifacts",
                    "status": "researching",
                    "message": f"Generating {len(suggested)} artifacts...",
                })

                generated_count = 0
                for artifact_type in suggested:
                    title = ARTIFACT_TITLES.get(artifact_type, artifact_type)
                    yield _sse_event("agent_status", {
                        "agent_id": "artifacts",
                        "status": "researching",
                        "message": f"Creating {title}...",
                    })
                    artifact = await extract_single_artifact(artifact_type, findings_text)
                    if artifact:
                        generated_count += 1
                        generated_artifacts.append(artifact)
                        yield _sse_event("artifact", artifact)

                yield _sse_event("agent_status", {
                    "agent_id": "artifacts",
                    "status": "complete",
                    "message": f"Generated {generated_count} of {len(suggested)} artifacts",
                })
            else:
                yield _sse_event("agent_status", {
                    "agent_id": "artifacts",
                    "status": "complete",
                    "message": "No artifacts could be generated from available data",
                })

        # --- Memory persistence (non-blocking, after response) ---
        yield _sse_event("agent_status", {
            "agent_id": "memory",
            "status": "researching",
            "message": "Saving to memory...",
        })

        try:
            # Episodic: store the full conversation episode
            store.store_episode(session_id, query, synthesis_result, all_findings, generated_artifacts)

            # Semantic: extract and store facts
            from app.memory.extractor import extract_semantic_facts, extract_procedural_patterns

            facts = await extract_semantic_facts(query, synthesis_result, all_findings)
            store.store_semantic_facts(session_id, facts)

            # Procedural: extract and store patterns
            patterns = await extract_procedural_patterns(query, all_findings)
            for p in patterns:
                store.store_procedure(p)

            yield _sse_event("agent_status", {
                "agent_id": "memory",
                "status": "complete",
                "message": f"Saved {len(facts)} facts and {len(patterns)} patterns to memory",
            })
        except Exception:
            yield _sse_event("agent_status", {
                "agent_id": "memory",
                "status": "complete",
                "message": "Memory save completed with partial results",
            })

    except Exception as e:
        yield _sse_event("agent_status", {
            "agent_id": "system",
            "status": "failed",
            "message": str(e),
        })
        yield _sse_event("error", {"message": f"System error: {str(e)}"})

    yield _sse_event("done", {"session_id": session_id})


def _sse_event(event_type: str, data: dict) -> str:
    """Format an SSE event as a JSON string."""
    return json.dumps({"event": event_type, "data": data})
