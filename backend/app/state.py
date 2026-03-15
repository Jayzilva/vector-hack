from typing import Annotated, TypedDict

from langgraph.graph import add_messages


class AgentFindings(TypedDict):
    agent_id: str
    domain: str
    status: str
    confidence: str
    findings: list[dict]
    summary: str


def merge_findings(left: list[AgentFindings], right: list[AgentFindings]) -> list[AgentFindings]:
    """Merge agent findings lists, updating existing entries by agent_id."""
    merged = {f["agent_id"]: f for f in left}
    for f in right:
        merged[f["agent_id"]] = f
    return list(merged.values())


class GraphState(TypedDict):
    query: str
    conversation_history: list[dict]
    messages: Annotated[list, add_messages]
    decomposed_tasks: list[dict]
    agent_findings: Annotated[list[AgentFindings], merge_findings]
    synthesis: str
