"use client";

import { useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Search,
  Globe,
  Brain,
  AlertCircle,
  Wrench,
} from "lucide-react";
import type { AgentStatus, RunStep } from "../hooks/useChat";

interface AgentStatusPanelProps {
  statuses: AgentStatus[];
  runSteps: RunStep[];
  isLoading: boolean;
}

export default function AgentStatusPanel({
  statuses,
  runSteps,
  isLoading,
}: AgentStatusPanelProps) {
  if (statuses.length === 0) return null;

  return (
    <div className="mx-4 mb-4 rounded-xl border border-zinc-700 bg-zinc-900 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Agent Activity
      </div>
      <div className="space-y-1">
        {statuses.map((status) => (
          <AgentRow
            key={status.agent_id}
            status={status}
            steps={runSteps.filter((s) => s.agent_id === status.agent_id)}
            isLoading={isLoading}
          />
        ))}
      </div>
    </div>
  );
}

function AgentRow({
  status,
  steps,
  isLoading,
}: {
  status: AgentStatus;
  steps: RunStep[];
  isLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasSteps = steps.length > 0;
  const isDone = status.status === "complete" || status.status === "failed";

  return (
    <div>
      <button
        type="button"
        onClick={() => hasSteps && setExpanded(!expanded)}
        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
          hasSteps
            ? "hover:bg-zinc-800 cursor-pointer"
            : "cursor-default"
        }`}
      >
        <StatusIcon status={status.status} />
        <span className="font-medium text-zinc-200">
          {formatAgentName(status.agent_id)}
        </span>
        <span className="flex-1 truncate text-zinc-500 text-xs">
          {status.message}
        </span>
        {hasSteps && (
          <span className="flex items-center gap-1 text-xs text-zinc-600">
            <span>{steps.length} steps</span>
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </span>
        )}
      </button>

      {expanded && hasSteps && (
        <div className="ml-6 mt-1 mb-2 border-l border-zinc-700 pl-3">
          {steps.map((step, i) => (
            <RunStepEntry key={`${step.agent_id}-${step.timestamp}-${i}`} step={step} />
          ))}
        </div>
      )}
    </div>
  );
}

function RunStepEntry({ step }: { step: RunStep }) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div className="py-1">
      <button
        type="button"
        onClick={() => setShowDetail(!showDetail)}
        className="flex w-full items-start gap-2 text-left text-xs hover:bg-zinc-800/50 rounded px-1 py-0.5 cursor-pointer"
      >
        <StepIcon type={step.type} />
        <div className="flex-1 min-w-0">
          <StepSummary step={step} />
        </div>
        <span className="text-zinc-600 shrink-0 text-[10px] mt-0.5">
          {formatTime(step.timestamp)}
        </span>
      </button>

      {showDetail && (
        <div className="ml-5 mt-1 rounded bg-zinc-800/50 px-2 py-1.5 text-[11px] text-zinc-400 max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
          {step.type === "tool_call" && (
            <>
              <span className="text-zinc-500">Tool:</span> {step.tool}
              {step.input && (
                <>
                  {"\n"}
                  <span className="text-zinc-500">Input:</span> {step.input}
                </>
              )}
            </>
          )}
          {step.type === "tool_result" && (
            <>
              <span className="text-zinc-500">Tool:</span> {step.tool}
              {"\n"}
              <span className="text-zinc-500">Output:</span>{"\n"}
              {step.output}
            </>
          )}
          {step.type === "thought" && step.content}
          {step.type === "error" && (
            <span className="text-red-400">{step.content}</span>
          )}
        </div>
      )}
    </div>
  );
}

function StepSummary({ step }: { step: RunStep }) {
  switch (step.type) {
    case "tool_call":
      return (
        <span className="text-yellow-400">
          Calling <span className="text-yellow-300 font-medium">{formatToolName(step.tool ?? "")}</span>
        </span>
      );
    case "tool_result":
      return (
        <span className="text-blue-400">
          Result from <span className="text-blue-300 font-medium">{formatToolName(step.tool ?? "")}</span>
          <span className="text-zinc-500"> — {(step.output ?? "").slice(0, 80)}...</span>
        </span>
      );
    case "thought":
      return (
        <span className="text-emerald-400">
          Reasoning
          <span className="text-zinc-500"> — {(step.content ?? "").slice(0, 100)}...</span>
        </span>
      );
    case "error":
      return (
        <span className="text-red-400">
          Error: {(step.content ?? "").slice(0, 100)}
        </span>
      );
    default:
      return <span className="text-zinc-400">{step.type}</span>;
  }
}

function StepIcon({ type }: { type: string }) {
  const cls = "h-3 w-3 mt-0.5 shrink-0";
  switch (type) {
    case "tool_call":
      return <Wrench className={`${cls} text-yellow-400`} />;
    case "tool_result":
      return <Globe className={`${cls} text-blue-400`} />;
    case "thought":
      return <Brain className={`${cls} text-emerald-400`} />;
    case "error":
      return <AlertCircle className={`${cls} text-red-400`} />;
    default:
      return <Search className={`${cls} text-zinc-400`} />;
  }
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "complete":
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />;
    case "failed":
    case "error":
      return <XCircle className="h-4 w-4 shrink-0 text-red-400" />;
    default:
      return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-yellow-400" />;
  }
}

function formatAgentName(id: string): string {
  return id
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatToolName(name: string): string {
  return name.replace(/_/g, " ");
}

function formatTime(ts: string): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}
