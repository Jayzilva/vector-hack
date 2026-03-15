"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, TrendingUp, Building2 } from "lucide-react";

interface Competitor {
  name: string;
  category: string;
  funding: string;
  key_features: string[];
  positioning: string;
  strength: string;
}

interface CompetitorCardsProps {
  data: {
    title: string;
    competitors: Competitor[];
  };
}

const strengthColors: Record<string, string> = {
  high: "bg-red-500/20 text-red-400 border-red-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/20 text-green-400 border-green-500/30",
};

const categoryColors: Record<string, string> = {
  "Direct Competitor": "bg-blue-500/20 text-blue-400",
  Direct: "bg-blue-500/20 text-blue-400",
  Indirect: "bg-purple-500/20 text-purple-400",
  Adjacent: "bg-amber-500/20 text-amber-400",
};

export default function CompetitorCards({ data }: CompetitorCardsProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {data.competitors.map((comp, i) => {
        const isExpanded = expandedIdx === i;
        return (
          <button
            type="button"
            key={comp.name}
            onClick={() => setExpandedIdx(isExpanded ? null : i)}
            className="w-full text-left rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 transition-colors hover:bg-zinc-800 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-zinc-400 shrink-0" />
              <span className="font-medium text-zinc-100 flex-1">
                {comp.name}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  categoryColors[comp.category] ?? "bg-zinc-700 text-zinc-300"
                }`}
              >
                {comp.category}
              </span>
              <span
                className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                  strengthColors[comp.strength] ?? strengthColors.medium
                }`}
              >
                {comp.strength}
              </span>
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
              )}
            </div>

            {isExpanded && (
              <div className="mt-3 space-y-2 border-t border-zinc-700 pt-3">
                <div className="text-xs text-zinc-400">
                  <span className="text-zinc-500">Positioning:</span>{" "}
                  {comp.positioning}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <TrendingUp className="h-3 w-3 text-zinc-500" />
                  <span className="text-zinc-500">Funding:</span>
                  <span className="text-zinc-300">{comp.funding}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {comp.key_features.map((feat) => (
                    <span
                      key={feat}
                      className="rounded bg-zinc-700/50 px-2 py-0.5 text-[10px] text-zinc-300"
                    >
                      {feat}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
