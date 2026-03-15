"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { useChat } from "./hooks/useChat";
import ChatMessage from "./components/ChatMessage";
import AgentStatusPanel from "./components/AgentStatusPanel";
import StarterChips from "./components/StarterChips";

export default function Home() {
  const { messages, isLoading, agentStatuses, runSteps, sendMessage } =
    useChat();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showPanel = agentStatuses.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, agentStatuses, runSteps]);

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
    <div className="flex h-screen flex-col bg-zinc-950">
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
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
            </>
          )}

          {/* Agent Status Panel — visible during and after research */}
          {showPanel && (
            <AgentStatusPanel
              statuses={agentStatuses}
              runSteps={runSteps}
              isLoading={isLoading}
            />
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
  );
}
