import json
import os

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

FACT_EXTRACTION_PROMPT = """You are a knowledge extraction agent. Extract specific factual claims from this research synthesis and agent findings.

Only extract concrete, verifiable facts — not opinions or vague statements. Each fact should be a standalone statement.

Research query: {query}

Synthesis:
{synthesis}

Respond with ONLY valid JSON — no markdown:
[
  {{
    "content": "The specific factual claim",
    "confidence": "high | medium | low",
    "source_agent": "agent_id that found this"
  }}
]

Extract 5-10 of the most important facts. If there are no concrete facts, return an empty list []."""

PROCEDURAL_EXTRACTION_PROMPT = """You are a research methodology analyst. Given this query and the results from different research agents, identify what research approaches worked well.

Query: {query}

Agent results:
{agent_results}

Analyze which agents produced the richest findings and what tools/approaches were most effective.

Respond with ONLY valid JSON — no markdown:
[
  {{
    "description": "For [query type], [specific approach] yields the best results because [reason]",
    "query_type": "pricing | competitive | market_trend | sentiment | positioning | adjacent",
    "success_score": 0.8
  }}
]

Return 2-4 patterns. If no clear patterns emerge, return an empty list []."""


def _get_llm():
    return ChatOpenAI(
        model="gpt-4o-mini",
        api_key=os.getenv("OPENAI_API_KEY"),
        max_tokens=2048,
    )


async def extract_semantic_facts(
    query: str, synthesis: str, agent_findings: list[dict]
) -> list[dict]:
    """Extract factual claims from research results."""
    llm = _get_llm()
    prompt = FACT_EXTRACTION_PROMPT.format(query=query, synthesis=synthesis[:3000])

    try:
        response = await llm.ainvoke([
            SystemMessage(content=prompt),
            HumanMessage(content="Extract the facts now."),
        ])
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0]
        facts = json.loads(content)
        return facts if isinstance(facts, list) else []
    except Exception:
        return []


async def extract_procedural_patterns(
    query: str, agent_findings: list[dict]
) -> list[dict]:
    """Extract research methodology patterns from agent results."""
    llm = _get_llm()

    agent_results = ""
    for f in agent_findings:
        status = f.get("status", "unknown")
        domain = f.get("domain", "")
        summary_len = len(f.get("summary", ""))
        run_steps = len(f.get("run_history", []))
        agent_results += f"- {f.get('agent_id', '')}: domain={domain}, status={status}, summary_length={summary_len}, tool_calls={run_steps}\n"

    prompt = PROCEDURAL_EXTRACTION_PROMPT.format(query=query, agent_results=agent_results)

    try:
        response = await llm.ainvoke([
            SystemMessage(content=prompt),
            HumanMessage(content="Identify the patterns now."),
        ])
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0]
        patterns = json.loads(content)
        return patterns if isinstance(patterns, list) else []
    except Exception:
        return []
