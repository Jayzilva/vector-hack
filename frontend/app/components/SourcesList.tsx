"use client";

import {
  Building2,
  FlaskConical,
  Newspaper,
  Users,
  MessageCircle,
  ExternalLink,
} from "lucide-react";

interface ParsedSource {
  title: string;
  url: string;
  tier: string;
  score: number;
}

const tierConfig: Record<
  string,
  { icon: React.ReactNode; color: string; bg: string }
> = {
  Official: {
    icon: <Building2 className="h-3 w-3" />,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  Research: {
    icon: <FlaskConical className="h-3 w-3" />,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  News: {
    icon: <Newspaper className="h-3 w-3" />,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  Community: {
    icon: <Users className="h-3 w-3" />,
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
  },
  Social: {
    icon: <MessageCircle className="h-3 w-3" />,
    color: "text-zinc-400",
    bg: "bg-zinc-500/10 border-zinc-500/20",
  },
};

function parseSource(line: string): ParsedSource | null {
  // Match: - [title](url) `tier` `score/5`
  const match = line.match(
    /^\s*[-*]\s+\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s*`([^`]+)`\s*`(\d)\/5`/,
  );
  if (match) {
    return {
      title: match[1],
      url: match[2],
      tier: match[3],
      score: parseInt(match[4], 10),
    };
  }
  // Fallback: - [title](url) without credibility (older responses)
  const fallback = line.match(/^\s*[-*]\s+\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
  if (fallback) {
    return { title: fallback[1], url: fallback[2], tier: "News", score: 3 };
  }
  return null;
}

export function extractSources(content: string): {
  sources: ParsedSource[];
  contentWithoutSources: string;
} {
  // Find the ## Sources section
  const sourcesIdx = content.search(/^##\s+Sources/m);
  if (sourcesIdx === -1) {
    return { sources: [], contentWithoutSources: content };
  }

  const beforeSources = content.slice(0, sourcesIdx).trimEnd();
  const sourcesSection = content.slice(sourcesIdx);
  const lines = sourcesSection.split("\n");
  const sources: ParsedSource[] = [];

  for (const line of lines) {
    const parsed = parseSource(line);
    if (parsed) sources.push(parsed);
  }

  return { sources, contentWithoutSources: beforeSources };
}

interface SourcesListProps {
  sources: ParsedSource[];
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${
            i <= score ? "bg-current" : "bg-zinc-700"
          }`}
        />
      ))}
    </div>
  );
}

export default function SourcesList({ sources }: SourcesListProps) {
  if (sources.length === 0) return null;

  // Sort by score descending
  const sorted = [...sources].sort((a, b) => b.score - a.score);

  return (
    <div className="mt-4 rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Sources &amp; Credibility
      </h3>
      <div className="space-y-2">
        {sorted.map((s, i) => {
          const config = tierConfig[s.tier] || tierConfig.News;
          return (
            <div
              key={`${s.url}-${i}`}
              className="flex items-start gap-2.5"
            >
              <div
                className={`mt-0.5 flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${config.bg} ${config.color}`}
              >
                {config.icon}
                {s.tier}
              </div>
              <div className="min-w-0 flex-1">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-1 text-sm text-zinc-300 hover:text-blue-400"
                >
                  <span className="truncate">{s.title}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                </a>
              </div>
              <div className={`flex shrink-0 items-center gap-1 text-[10px] ${config.color}`}>
                <ScoreBar score={s.score} />
                <span>{s.score}/5</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
