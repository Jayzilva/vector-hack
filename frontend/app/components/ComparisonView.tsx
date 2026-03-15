"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Shield, Zap, Target, Trophy, AlertTriangle } from "lucide-react";
import SourcesList, { extractSources } from "./SourcesList";

interface ComparisonViewProps {
  content: string;
  entities: string[];
}

/** Split markdown by ## headings into named sections */
function parseSections(md: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const parts = md.split(/^## /m);
  for (const part of parts) {
    if (!part.trim()) continue;
    const newline = part.indexOf("\n");
    if (newline === -1) continue;
    const title = part.slice(0, newline).trim().toLowerCase();
    const body = part.slice(newline + 1).trim();
    sections[title] = body;
  }
  return sections;
}

/** Extract strengths/weaknesses per entity from a section */
function parseEntityBlocks(
  text: string,
  entities: string[],
): Record<string, { strengths: string[]; weaknesses: string[] }> {
  const result: Record<string, { strengths: string[]; weaknesses: string[] }> =
    {};
  for (const e of entities) result[e] = { strengths: [], weaknesses: [] };

  // Try to split by ### entity headers or **entity** bold markers
  let currentEntity = "";
  let inStrengths = true;

  for (const line of text.split("\n")) {
    const lower = line.toLowerCase().trim();

    // Detect entity header
    for (const e of entities) {
      if (lower.includes(e.toLowerCase())) {
        currentEntity = e;
        break;
      }
    }

    // Detect strengths vs weaknesses
    if (lower.includes("strength")) inStrengths = true;
    if (lower.includes("weakness") || lower.includes("limitation") || lower.includes("cons"))
      inStrengths = false;

    // Collect bullet points
    const bullet = line.match(/^\s*[-*]\s+(.+)/);
    if (bullet && currentEntity && result[currentEntity]) {
      if (inStrengths) {
        result[currentEntity].strengths.push(bullet[1]);
      } else {
        result[currentEntity].weaknesses.push(bullet[1]);
      }
    }
  }

  return result;
}

const mdComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mt-3 mb-2 text-lg font-bold text-zinc-50 first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mt-3 mb-2 text-base font-bold text-zinc-50 first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mt-2 mb-1 text-sm font-bold text-zinc-100 first:mt-0">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 text-sm leading-relaxed text-zinc-200 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 ml-4 list-disc space-y-1 text-sm text-zinc-200">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-1 text-sm text-zinc-200">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-sm leading-relaxed">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-zinc-50">{children}</strong>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-400 underline decoration-blue-400/30 hover:decoration-blue-400"
    >
      {children}
    </a>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-zinc-700">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-zinc-900 text-left text-xs font-semibold text-zinc-300">{children}</thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-3 py-2">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border-t border-zinc-700 px-3 py-2 text-zinc-300">{children}</td>
  ),
  hr: () => <hr className="my-3 border-zinc-700" />,
};

const entityColors = [
  { border: "border-blue-500/30", bg: "bg-blue-500/5", accent: "text-blue-400", dot: "bg-blue-400" },
  { border: "border-emerald-500/30", bg: "bg-emerald-500/5", accent: "text-emerald-400", dot: "bg-emerald-400" },
  { border: "border-amber-500/30", bg: "bg-amber-500/5", accent: "text-amber-400", dot: "bg-amber-400" },
  { border: "border-purple-500/30", bg: "bg-purple-500/5", accent: "text-purple-400", dot: "bg-purple-400" },
];

export default function ComparisonView({ content, entities }: ComparisonViewProps) {
  const { sources, contentWithoutSources } = useMemo(
    () => extractSources(content),
    [content],
  );

  const sections = useMemo(
    () => parseSections(contentWithoutSources),
    [contentWithoutSources],
  );

  const entityBlocks = useMemo(() => {
    const swSection =
      sections["strengths & weaknesses"] ||
      sections["strengths and weaknesses"] ||
      "";
    return parseEntityBlocks(swSection, entities);
  }, [sections, entities]);

  // Find sections for the different parts
  const executiveSummary = sections["executive summary"] || "";
  const verdict = sections["verdict"] || "";
  const confidence = sections["confidence assessment"] || "";

  // Find comparison sections (tables)
  const headToHead = sections["head-to-head comparison"] || "";

  return (
    <div className="mb-4 space-y-4">
      {/* Executive Summary */}
      {executiveSummary && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Target className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-zinc-100">Executive Summary</h2>
          </div>
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {executiveSummary}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Head-to-Head Tables */}
      {headToHead && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-bold text-zinc-100">Head-to-Head Comparison</h2>
          </div>
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {headToHead}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Side-by-Side Strengths & Weaknesses */}
      {Object.values(entityBlocks).some(
        (b) => b.strengths.length > 0 || b.weaknesses.length > 0,
      ) && (
        <div>
          <div className="mb-2 flex items-center gap-2 px-1">
            <Shield className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-bold text-zinc-100">Strengths & Weaknesses</h2>
          </div>
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${entities.length}, minmax(0, 1fr))`,
            }}
          >
            {entities.map((entity, i) => {
              const color = entityColors[i % entityColors.length];
              const block = entityBlocks[entity] || { strengths: [], weaknesses: [] };
              return (
                <div
                  key={entity}
                  className={`rounded-xl border ${color.border} ${color.bg} p-4`}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${color.dot}`} />
                    <h3 className={`text-sm font-bold capitalize ${color.accent}`}>
                      {entity}
                    </h3>
                  </div>

                  {block.strengths.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400/70">
                        Strengths
                      </p>
                      <ul className="space-y-1">
                        {block.strengths.map((s, j) => (
                          <li
                            key={j}
                            className="flex items-start gap-1.5 text-xs text-zinc-300"
                          >
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {block.weaknesses.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-red-400/70">
                        Weaknesses
                      </p>
                      <ul className="space-y-1">
                        {block.weaknesses.map((w, j) => (
                          <li
                            key={j}
                            className="flex items-start gap-1.5 text-xs text-zinc-300"
                          >
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-400" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Verdict */}
      {verdict && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-indigo-300">Verdict</h2>
          </div>
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {verdict}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Confidence */}
      {confidence && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-bold text-zinc-400">Confidence Assessment</h2>
          </div>
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {confidence}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Sources */}
      <SourcesList sources={sources} />
    </div>
  );
}
