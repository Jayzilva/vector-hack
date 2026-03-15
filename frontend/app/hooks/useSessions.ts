"use client";

import { useState, useEffect, useCallback } from "react";

export interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/sessions");
      if (!res.ok) return;
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const deleteSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`http://localhost:8000/api/sessions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // ignore
    }
  }, []);

  return { sessions, loading, refresh: fetchSessions, deleteSession };
}
