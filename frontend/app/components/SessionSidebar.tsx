"use client";

import { MessageSquarePlus, History, Loader2 } from "lucide-react";
import { Session } from "../hooks/useSessions";

interface SessionSidebarProps {
  sessions: Session[];
  loading: boolean;
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

export default function SessionSidebar({
  sessions,
  loading,
  activeSessionId,
  onNewChat,
  onSelectSession,
}: SessionSidebarProps) {
  return (
    <div className="flex h-full w-64 flex-col border-r border-zinc-800 bg-zinc-900">
      <div className="p-3">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2.5 text-sm text-zinc-200 transition-colors hover:bg-zinc-800"
        >
          <MessageSquarePlus className="h-4 w-4" />
          New Chat
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 py-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
        <History className="h-3 w-3" />
        Past Sessions
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {loading && sessions.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-zinc-600">
            No previous sessions
          </p>
        ) : (
          sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectSession(s.id)}
              className={`mb-1 w-full rounded-lg px-3 py-2 text-left transition-colors ${
                activeSessionId === s.id
                  ? "bg-zinc-700/50 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              <p className="truncate text-sm">{s.title}</p>
              <p className="mt-0.5 text-xs text-zinc-600">
                {formatDate(s.updated_at)}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
