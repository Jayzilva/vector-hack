"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { useChat } from "./hooks/useChat";
import { useSessions } from "./hooks/useSessions";
import ChatMessage from "./components/ChatMessage";
import AgentStatusPanel from "./components/AgentStatusPanel";
import ArtifactRenderer from "./components/artifacts/ArtifactRenderer";
import StarterChips from "./components/StarterChips";
import SessionSidebar from "./components/SessionSidebar";

export default function Home() {
  const {
    messages,
    isLoading,
    agentStatuses,
    runSteps,
    artifacts,
    artifactSuggestions,
    sessionId,
    sendMessage,
    startNewSession,
    loadSession,
  } = useChat();
  const { sessions, loading: sessionsLoading, refresh: refreshSessions } = useSessions();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showPanel = agentStatuses.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, agentStatuses, runSteps, artifacts]);

  // Refresh session list when a query completes
  useEffect(() => {
    if (!isLoading && sessionId) {
      refreshSessions();
    }
  }, [isLoading, sessionId, refreshSessions]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
  };

  const handleChipSelect = (query: string) => {
    sendMessage(query);
  };

  return (
    <div className="flex h-screen bg-zinc-950">
      {/* Session Sidebar */}
      <SessionSidebar
        sessions={sessions}
        loading={sessionsLoading}
        activeSessionId={sessionId}
        onNewChat={startNewSession}
        onSelectSession={loadSession}
      />

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="border-b border-zinc-800 bg-zinc-950 px-6 py-4">
          <h1 className="text-lg font-semibold text-zinc-100">
            Growth Intelligence Platform
          </h1>
          <p className="text-xs text-zinc-500">
            AI-powered multi-agent research system
          </p>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-3xl">
            {messages.length === 0 ? (
              <StarterChips onSelect={handleChipSelect} />
            ) : (
              <>
                {messages.map((msg, idx) => {
                  const isLastUser =
                    msg.role === "user" &&
                    (idx === messages.length - 1 ||
                      messages[idx + 1]?.role === "assistant");
                  const shouldShowPanel = isLastUser && showPanel;

                  const isLastAssistant =
                    msg.role === "assistant" && idx === messages.length - 1;
                  const showArtifacts =
                    isLastAssistant &&
                    (artifacts.length > 0 || artifactSuggestions);

                  return (
                    <div key={msg.id}>
                      <ChatMessage message={msg} />
                      {shouldShowPanel && (
                        <AgentStatusPanel
                          statuses={agentStatuses}
                          runSteps={runSteps}
                          isLoading={isLoading}
                        />
                      )}
                      {showArtifacts && (
                        <ArtifactRenderer
                          artifacts={artifacts}
                          suggestions={artifactSuggestions}
                        />
                      )}
                    </div>
                  );
                })}
              </>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-zinc-800 bg-zinc-950 px-4 py-4">
          <form
            onSubmit={handleSubmit}
            className="mx-auto flex max-w-3xl items-center gap-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a growth intelligence question..."
              disabled={isLoading}
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-zinc-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
