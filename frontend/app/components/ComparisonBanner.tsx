"use client";

import { GitCompareArrows } from "lucide-react";

interface ComparisonBannerProps {
  entities: string[];
}

export default function ComparisonBanner({ entities }: ComparisonBannerProps) {
  if (entities.length < 2) return null;

  return (
    <div className="mb-3 flex items-center gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-2.5">
      <GitCompareArrows className="h-4 w-4 shrink-0 text-indigo-400" />
      <div className="flex flex-1 items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-indigo-400">
          Comparison Mode
        </span>
        <div className="flex items-center gap-1.5">
          {entities.map((entity, i) => (
            <span key={entity} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-xs text-zinc-600">vs</span>}
              <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-xs font-medium capitalize text-indigo-300">
                {entity}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
