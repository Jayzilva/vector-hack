import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

import chromadb
from chromadb.config import Settings

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


def _get_db_path() -> str:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return str(DATA_DIR / "memory.db")


def _get_chroma_path() -> str:
    chroma_dir = DATA_DIR / "chroma"
    chroma_dir.mkdir(parents=True, exist_ok=True)
    return str(chroma_dir)


class MemoryStore:
    """Unified memory store: semantic (ChromaDB), episodic (SQLite+ChromaDB), procedural (ChromaDB)."""

    def __init__(self):
        self._db_path = _get_db_path()
        self._init_sqlite()

        self._chroma = chromadb.PersistentClient(
            path=_get_chroma_path(),
            settings=Settings(anonymized_telemetry=False),
        )
        self._semantic_col = self._chroma.get_or_create_collection("semantic_facts")
        self._episodic_col = self._chroma.get_or_create_collection("episodic_summaries")
        self._procedural_col = self._chroma.get_or_create_collection("procedural_patterns")

    # ------------------------------------------------------------------
    # SQLite setup
    # ------------------------------------------------------------------
    def _init_sqlite(self):
        conn = sqlite3.connect(self._db_path)
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                title TEXT,
                created_at TEXT,
                updated_at TEXT
            );
            CREATE TABLE IF NOT EXISTS episodic_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                role TEXT,
                content TEXT,
                synthesis TEXT,
                artifacts_json TEXT,
                agent_findings_json TEXT,
                created_at TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            );
        """)
        conn.commit()
        # Migrate: add agent_findings_json column if missing (for existing DBs)
        cursor = conn.execute("PRAGMA table_info(episodic_messages)")
        columns = {row[1] for row in cursor.fetchall()}
        if "agent_findings_json" not in columns:
            conn.execute("ALTER TABLE episodic_messages ADD COLUMN agent_findings_json TEXT")
            conn.commit()
        conn.close()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        return conn

    # ------------------------------------------------------------------
    # Session management
    # ------------------------------------------------------------------
    def create_session(self) -> str:
        session_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        conn = self._conn()
        conn.execute(
            "INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (session_id, "New Research", now, now),
        )
        conn.commit()
        conn.close()
        return session_id

    def list_sessions(self, limit: int = 20) -> list[dict]:
        conn = self._conn()
        rows = conn.execute(
            "SELECT id, title, created_at, updated_at FROM sessions ORDER BY updated_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def delete_session(self, session_id: str) -> bool:
        conn = self._conn()
        conn.execute("DELETE FROM episodic_messages WHERE session_id = ?", (session_id,))
        conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        conn.commit()
        conn.close()
        # Also remove from ChromaDB episodic collection
        try:
            results = self._episodic_col.get(where={"session_id": session_id})
            if results and results["ids"]:
                self._episodic_col.delete(ids=results["ids"])
        except Exception:
            pass
        return True

    def get_session_history(self, session_id: str) -> list[dict]:
        conn = self._conn()
        rows = conn.execute(
            "SELECT role, content, synthesis, artifacts_json, agent_findings_json, created_at FROM episodic_messages WHERE session_id = ? ORDER BY created_at",
            (session_id,),
        ).fetchall()
        conn.close()
        results = []
        for r in rows:
            entry = dict(r)
            # Parse JSON fields
            if entry.get("artifacts_json"):
                try:
                    entry["artifacts"] = json.loads(entry["artifacts_json"])
                except (json.JSONDecodeError, TypeError):
                    entry["artifacts"] = []
            else:
                entry["artifacts"] = []
            if entry.get("agent_findings_json"):
                try:
                    entry["agent_findings"] = json.loads(entry["agent_findings_json"])
                except (json.JSONDecodeError, TypeError):
                    entry["agent_findings"] = []
            else:
                entry["agent_findings"] = []
            del entry["artifacts_json"]
            del entry["agent_findings_json"]
            results.append(entry)
        return results

    # ------------------------------------------------------------------
    # Episodic memory — store a complete research episode
    # ------------------------------------------------------------------
    def store_episode(
        self,
        session_id: str,
        query: str,
        synthesis: str,
        agent_findings: list[dict],
        artifacts: list[dict],
    ):
        now = datetime.now(timezone.utc).isoformat()
        conn = self._conn()

        # Update session title from first query
        current = conn.execute("SELECT title FROM sessions WHERE id = ?", (session_id,)).fetchone()
        if current and current["title"] == "New Research":
            title = query[:80]
            conn.execute("UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?", (title, now, session_id))
        else:
            conn.execute("UPDATE sessions SET updated_at = ? WHERE id = ?", (now, session_id))

        # Store user message
        conn.execute(
            "INSERT INTO episodic_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (session_id, "user", query, now),
        )

        # Store assistant response
        conn.execute(
            "INSERT INTO episodic_messages (session_id, role, content, synthesis, artifacts_json, agent_findings_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                session_id, "assistant", synthesis, synthesis,
                json.dumps(artifacts) if artifacts else None,
                json.dumps(agent_findings) if agent_findings else None,
                now,
            ),
        )
        conn.commit()
        conn.close()

        # Store episode summary in ChromaDB for semantic search
        summary = f"Query: {query}\nSummary: {synthesis[:500]}"
        domains = ", ".join(f.get("domain", "") for f in agent_findings if f.get("domain"))
        try:
            self._episodic_col.upsert(
                ids=[f"{session_id}_{now}"],
                documents=[summary],
                metadatas=[{
                    "session_id": session_id,
                    "query": query[:200],
                    "domains": domains,
                    "timestamp": now,
                }],
            )
        except Exception:
            pass

    def search_episodes(self, query: str, n_results: int = 3) -> list[dict]:
        try:
            count = self._episodic_col.count()
            if count == 0:
                return []
            results = self._episodic_col.query(
                query_texts=[query],
                n_results=min(n_results, count),
            )
            episodes = []
            for i, doc in enumerate(results["documents"][0]):
                meta = results["metadatas"][0][i] if results["metadatas"] else {}
                episodes.append({
                    "summary": doc,
                    "session_id": meta.get("session_id", ""),
                    "query": meta.get("query", ""),
                    "domains": meta.get("domains", ""),
                    "timestamp": meta.get("timestamp", ""),
                })
            return episodes
        except Exception:
            return []

    # ------------------------------------------------------------------
    # Semantic memory — factual knowledge from research
    # ------------------------------------------------------------------
    def store_semantic_facts(self, session_id: str, facts: list[dict]):
        if not facts:
            return
        now = datetime.now(timezone.utc).isoformat()
        ids = []
        documents = []
        metadatas = []
        for i, fact in enumerate(facts):
            fact_id = f"{session_id}_fact_{i}_{now}"
            ids.append(fact_id)
            documents.append(fact.get("content", ""))
            metadatas.append({
                "session_id": session_id,
                "source_agent": fact.get("source_agent", ""),
                "confidence": fact.get("confidence", "medium"),
                "timestamp": now,
            })
        try:
            self._semantic_col.upsert(ids=ids, documents=documents, metadatas=metadatas)
        except Exception:
            pass

    def search_semantic(self, query: str, n_results: int = 5) -> list[dict]:
        try:
            count = self._semantic_col.count()
            if count == 0:
                return []
            results = self._semantic_col.query(
                query_texts=[query],
                n_results=min(n_results, count),
            )
            facts = []
            for i, doc in enumerate(results["documents"][0]):
                meta = results["metadatas"][0][i] if results["metadatas"] else {}
                facts.append({
                    "content": doc,
                    "confidence": meta.get("confidence", "medium"),
                    "source_agent": meta.get("source_agent", ""),
                    "timestamp": meta.get("timestamp", ""),
                })
            return facts
        except Exception:
            return []

    # ------------------------------------------------------------------
    # Procedural memory — learned research patterns
    # ------------------------------------------------------------------
    def store_procedure(self, pattern: dict):
        now = datetime.now(timezone.utc).isoformat()
        pattern_id = f"proc_{now}_{uuid.uuid4().hex[:8]}"
        try:
            self._procedural_col.upsert(
                ids=[pattern_id],
                documents=[pattern.get("description", "")],
                metadatas=[{
                    "query_type": pattern.get("query_type", ""),
                    "success_score": str(pattern.get("success_score", 0.5)),
                    "timestamp": now,
                }],
            )
        except Exception:
            pass

    def search_procedures(self, query: str, n_results: int = 3) -> list[dict]:
        try:
            count = self._procedural_col.count()
            if count == 0:
                return []
            results = self._procedural_col.query(
                query_texts=[query],
                n_results=min(n_results, count),
            )
            procedures = []
            for i, doc in enumerate(results["documents"][0]):
                meta = results["metadatas"][0][i] if results["metadatas"] else {}
                procedures.append({
                    "description": doc,
                    "query_type": meta.get("query_type", ""),
                    "success_score": float(meta.get("success_score", 0.5)),
                })
            return procedures
        except Exception:
            return []
