import json

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.memory.store import MemoryStore

load_dotenv()

app = FastAPI(title="Growth Intelligence Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

memory_store = MemoryStore()


class QueryRequest(BaseModel):
    query: str
    conversation_history: list[dict] = []
    session_id: str | None = None


@app.get("/")
async def health():
    return {"status": "ok", "service": "growth-intelligence-platform"}


@app.post("/api/query")
async def query(request: QueryRequest):
    from app.agent import run_agent

    session_id = request.session_id or memory_store.create_session()

    async def event_stream():
        async for event_json in run_agent(
            request.query, request.conversation_history, session_id
        ):
            yield f"data: {event_json}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/sessions")
async def list_sessions():
    sessions = memory_store.list_sessions()
    return {"sessions": sessions}


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    history = memory_store.get_session_history(session_id)
    return {"session_id": session_id, "messages": history}


@app.get("/api/memory/search")
async def search_memory(q: str):
    facts = memory_store.search_semantic(q, n_results=5)
    episodes = memory_store.search_episodes(q, n_results=3)
    return {"facts": facts, "episodes": episodes}
