"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  BarChart3,
  Users,
  DollarSign,
  Heart,
  MessageSquare,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { Artifact, ArtifactSuggestions } from "../../hooks/useChat";
import CompetitorCards from "./CompetitorCards";
import TrendChart from "./TrendChart";
import PricingTable from "./PricingTable";
import SentimentScorecard from "./SentimentScorecard";
import MessagingMatrix from "./MessagingMatrix";

interface ArtifactRendererProps {
  artifacts: Artifact[];
  suggestions: ArtifactSuggestions | null;
}

const artifactMeta: Record<
  string,
  { icon: React.ReactNode; color: string; borderColor: string }
> = {
  competitive_landscape: {
    icon: <Users className="h-4 w-4" />,
    color: "text-blue-400",
    borderColor: "border-blue-500/30",
  },
  trend_chart: {
    icon: <BarChart3 className="h-4 w-4" />,
    color: "text-purple-400",
    borderColor: "border-purple-500/30",
  },
  pricing_table: {
    icon: <DollarSign className="h-4 w-4" />,
    color: "text-green-400",
    borderColor: "border-green-500/30",
  },
  sentiment_scorecard: {
    icon: <Heart className="h-4 w-4" />,
    color: "text-rose-400",
    borderColor: "border-rose-500/30",
  },
  messaging_matrix: {
    icon: <MessageSquare className="h-4 w-4" />,
    color: "text-amber-400",
    borderColor: "border-amber-500/30",
  },
};

export default function ArtifactRenderer({
  artifacts,
  suggestions,
}: ArtifactRendererProps) {
  const hasContent = artifacts.length > 0 || suggestions;
  if (!hasContent) return null;

  const generatedTypes = new Set(artifacts.map((a) => a.type));

  return (
    <div className="mb-4 space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="h-3.5 w-3.5 text-zinc-500" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Interactive Artifacts
        </span>
        {suggestions && artifacts.length < suggestions.suggested.length && (
          <span className="text-[10px] text-zinc-600">
            ({artifacts.length}/{suggestions.suggested.length} ready)
          </span>
        )}
      </div>

      {/* Show suggestions that are still being generated */}
      {suggestions &&
        suggestions.suggested
          .filter((type) => !generatedTypes.has(type))
          .map((type) => {
            const meta = artifactMeta[type];
            const title = suggestions.titles[type] || type;
            return (
              <div
                key={`pending-${type}`}
                className="flex items-center gap-2.5 rounded-xl border border-zinc-700 bg-zinc-900/50 px-4 py-3"
              >
                <Loader2
                  className={`h-4 w-4 animate-spin ${meta?.color ?? "text-zinc-400"}`}
                />
                <span className="text-sm text-zinc-400">{title}</span>
                <span className="text-[10px] text-zinc-600">generating...</span>
              </div>
            );
          })}

      {/* Render completed artifacts */}
      {artifacts.map((artifact, idx) => (
        <ArtifactCard key={`${artifact.type}-${idx}`} artifact={artifact} />
      ))}
    </div>
  );
}

function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const [expanded, setExpanded] = useState(true);
  const meta = artifactMeta[artifact.type] ?? {
    icon: <BarChart3 className="h-4 w-4" />,
    color: "text-zinc-400",
    borderColor: "border-zinc-700",
  };

  return (
    <div className={`rounded-xl border ${meta.borderColor} bg-zinc-900 overflow-hidden`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-zinc-800/50 transition-colors cursor-pointer"
      >
        <span className={meta.color}>{meta.icon}</span>
        <span className="flex-1 text-sm font-medium text-zinc-200">
          {artifact.title}
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1">
          <ArtifactContent artifact={artifact} />
        </div>
      )}
    </div>
  );
}

function ArtifactContent({ artifact }: { artifact: Artifact }) {
  switch (artifact.type) {
    case "competitive_landscape":
      return <CompetitorCards data={artifact.data} />;
    case "trend_chart":
      return <TrendChart data={artifact.data} />;
    case "pricing_table":
      return <PricingTable data={artifact.data} />;
    case "sentiment_scorecard":
      return <SentimentScorecard data={artifact.data} />;
    case "messaging_matrix":
      return <MessagingMatrix data={artifact.data} />;
    default:
      return (
        <pre className="text-xs text-zinc-400 overflow-x-auto">
          {JSON.stringify(artifact.data, null, 2)}
        </pre>
      );
  }
}
