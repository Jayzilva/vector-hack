"use client";

import { useState, useCallback, useRef } from "react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface AgentStatus {
  agent_id: string;
  status: string;
  message: string;
}

export interface RunStep {
  type: "tool_call" | "tool_result" | "thought" | "error";
  agent_id: string;
  tool?: string;
  input?: string;
  output?: string;
  content?: string;
  timestamp: string;
}

export interface Artifact {
  type: string;
  title: string;
  // biome-ignore lint/suspicious/noExplicitAny: artifact data varies by type
  data: any;
}

export interface ArtifactSuggestions {
  suggested: string[];
  titles: Record<string, string>;
}

interface SSEEvent {
  event: string;
  data: Record<string, unknown>;
}

const API_URL = "/api/query";

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([]);
  const [runSteps, setRunSteps] = useState<RunStep[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [artifactSuggestions, setArtifactSuggestions] =
    useState<ArtifactSuggestions | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [comparisonMode, setComparisonMode] = useState<{
    enabled: boolean;
    entities: string[];
  }>({ enabled: false, entities: [] });
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (query: string) => {
      if (!query.trim() || isLoading) return;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: query.trim(),
      };

      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setAgentStatuses([]);
      setRunSteps([]);
      setArtifacts([]);
      setArtifactSuggestions(null);
      setFollowUpQuestions([]);
      setComparisonMode({ enabled: false, entities: [] });

      abortRef.current = new AbortController();

      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: query.trim(),
            conversation_history: conversationHistory,
            session_id: sessionId,
            model: selectedModel,
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let assistantContent = "";
        const assistantId = crypto.randomUUID();

        // Add empty assistant message
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "" },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;

            try {
              const parsed: SSEEvent = JSON.parse(trimmed.slice(6));
              const { event, data } = parsed;

              switch (event) {
                case "agent_status": {
                  const status: AgentStatus = {
                    agent_id: String(data.agent_id ?? ""),
                    status: String(data.status ?? ""),
                    message: String(data.message ?? ""),
                  };
                  setAgentStatuses((prev) => {
                    const existing = prev.findIndex(
                      (s) => s.agent_id === status.agent_id,
                    );
                    if (existing >= 0) {
                      const updated = [...prev];
                      updated[existing] = status;
                      return updated;
                    }
                    return [...prev, status];
                  });
                  break;
                }

                case "run_step": {
                  const step: RunStep = {
                    type: String(data.type ?? "thought") as RunStep["type"],
                    agent_id: String(data.agent_id ?? ""),
                    tool: data.tool ? String(data.tool) : undefined,
                    input: data.input ? String(data.input) : undefined,
                    output: data.output ? String(data.output) : undefined,
                    content: data.content ? String(data.content) : undefined,
                    timestamp: String(data.timestamp ?? ""),
                  };
                  setRunSteps((prev) => [...prev, step]);
                  break;
                }

                case "finding":
                  break;

                case "artifact_suggestions": {
                  setArtifactSuggestions({
                    suggested: (data.suggested as string[]) ?? [],
                    titles: (data.titles as Record<string, string>) ?? {},
                  });
                  break;
                }

                case "artifact": {
                  const artifact: Artifact = {
                    type: String(data.type ?? ""),
                    title: String(data.title ?? ""),
                    data: data.data ?? {},
                  };
                  setArtifacts((prev) => [...prev, artifact]);
                  break;
                }

                case "synthesis":
                  assistantContent = (data.summary as string) || "";
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: assistantContent }
                        : m,
                    ),
                  );
                  if (data.comparison) {
                    setComparisonMode({
                      enabled: true,
                      entities: (data.entities as string[]) || [],
                    });
                  }
                  break;

                case "error":
                  assistantContent = `Error: ${data.message || "Unknown error"}`;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: assistantContent }
                        : m,
                    ),
                  );
                  break;

                case "followup_questions": {
                  const questions = (data.questions as string[]) ?? [];
                  setFollowUpQuestions(questions);
                  break;
                }

                case "done":
                  if (data.session_id) {
                    setSessionId(String(data.session_id));
                  }
                  setIsLoading(false);
                  break;
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          const errorMsg = `Connection error: ${(err as Error).message}`;
          setMessages((prev) => [
            ...prev.filter((m) => m.role !== "assistant" || m.content !== ""),
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: errorMsg,
            },
          ]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, sessionId, selectedModel],
  );

  const startNewSession = useCallback(() => {
    setSessionId(null);
    setMessages([]);
    setAgentStatuses([]);
    setRunSteps([]);
    setArtifacts([]);
    setArtifactSuggestions(null);
    setFollowUpQuestions([]);
    setComparisonMode({ enabled: false, entities: [] });
  }, []);

  const loadSession = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`/api/sessions/${sid}`);
      if (!res.ok) return;
      const data = await res.json();
      setSessionId(sid);
      setArtifactSuggestions(null);

      // Restore messages
      const loaded: Message[] = (data.messages || []).map(
        // biome-ignore lint/suspicious/noExplicitAny: session message shape from API
        (m: any, i: number) => ({
          id: `loaded-${i}`,
          role: m.role as "user" | "assistant",
          content: m.synthesis || m.content || "",
        }),
      );
      setMessages(loaded);

      // Restore artifacts from the last assistant message
      const restoredArtifacts: Artifact[] = [];
      const restoredStatuses: AgentStatus[] = [];
      const restoredSteps: RunStep[] = [];

      // biome-ignore lint/suspicious/noExplicitAny: session message shape from API
      const assistantMsgs = (data.messages || []).filter((m: any) => m.role === "assistant");
      const lastAssistant = assistantMsgs[assistantMsgs.length - 1];

      if (lastAssistant) {
        // Restore artifacts
        if (lastAssistant.artifacts && Array.isArray(lastAssistant.artifacts)) {
          for (const a of lastAssistant.artifacts) {
            restoredArtifacts.push({
              type: String(a.type ?? ""),
              title: String(a.title ?? ""),
              data: a.data ?? {},
            });
          }
        }

        // Restore agent statuses and run steps from findings
        if (lastAssistant.agent_findings && Array.isArray(lastAssistant.agent_findings)) {
          // biome-ignore lint/suspicious/noExplicitAny: finding shape from API
          for (const f of lastAssistant.agent_findings) {
            restoredStatuses.push({
              agent_id: String(f.agent_id ?? ""),
              status: String(f.status ?? "complete"),
              message: `${f.domain || ""} analysis complete`,
            });

            // Restore run history (chain-of-thought steps)
            if (f.run_history && Array.isArray(f.run_history)) {
              // biome-ignore lint/suspicious/noExplicitAny: run step shape from API
              for (const step of f.run_history) {
                restoredSteps.push({
                  type: String(step.type ?? "thought") as RunStep["type"],
                  agent_id: String(step.agent_id ?? f.agent_id ?? ""),
                  tool: step.tool ? String(step.tool) : undefined,
                  input: step.input ? String(step.input) : undefined,
                  output: step.output ? String(step.output) : undefined,
                  content: step.content ? String(step.content) : undefined,
                  timestamp: String(step.timestamp ?? ""),
                });
              }
            }
          }
        }
      }

      setArtifacts(restoredArtifacts);
      setAgentStatuses(restoredStatuses);
      setRunSteps(restoredSteps);
    } catch {
      // ignore fetch errors
    }
  }, []);

  return {
    messages,
    isLoading,
    agentStatuses,
    runSteps,
    artifacts,
    artifactSuggestions,
    followUpQuestions,
    comparisonMode,
    selectedModel,
    setSelectedModel,
    sessionId,
    sendMessage,
    startNewSession,
    loadSession,
  };
}
