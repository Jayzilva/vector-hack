"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "../hooks/useChat";
import { useTypewriter } from "../hooks/useTypewriter";
import SourcesList, { extractSources } from "./SourcesList";

interface ChatMessageProps {
  message: Message;
  streaming?: boolean;
}

export default function ChatMessage({ message, streaming = false }: ChatMessageProps) {
  const isUser = message.role === "user";

  // Extract sources from assistant messages for separate rendering
  const { sources, contentWithoutSources } = useMemo(() => {
    if (isUser || !message.content) return { sources: [], contentWithoutSources: message.content };
    return extractSources(message.content);
  }, [message.content, isUser]);

  const displayContent = useTypewriter(
    sources.length > 0 ? contentWithoutSources : message.content,
    streaming && !isUser,
  );

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-zinc-800 text-zinc-100 border border-zinc-700"
        }`}
      >
        {displayContent ? (
          isUser ? (
            <div className="text-sm leading-relaxed">{displayContent}</div>
          ) : (
            <>
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="mt-4 mb-2 text-lg font-bold text-zinc-50 first:mt-0">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="mt-4 mb-2 text-base font-bold text-zinc-50 first:mt-0">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="mt-3 mb-1 text-sm font-bold text-zinc-100 first:mt-0">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="mb-2 text-sm leading-relaxed text-zinc-200 last:mb-0">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="mb-2 ml-4 list-disc space-y-1 text-sm text-zinc-200">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="mb-2 ml-4 list-decimal space-y-1 text-sm text-zinc-200">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-sm leading-relaxed">{children}</li>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-zinc-50">
                      {children}
                    </strong>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 underline decoration-blue-400/30 hover:decoration-blue-400"
                    >
                      {children}
                    </a>
                  ),
                  code: ({ children, className }) => {
                    const isBlock = className?.includes("language-");
                    return isBlock ? (
                      <pre className="my-2 overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs">
                        <code className="text-zinc-200">{children}</code>
                      </pre>
                    ) : (
                      <code className="rounded bg-zinc-700 px-1.5 py-0.5 text-xs text-zinc-200">
                        {children}
                      </code>
                    );
                  },
                  blockquote: ({ children }) => (
                    <blockquote className="my-2 border-l-2 border-zinc-600 pl-3 text-sm italic text-zinc-400">
                      {children}
                    </blockquote>
                  ),
                  table: ({ children }) => (
                    <div className="my-2 overflow-x-auto rounded-lg border border-zinc-700">
                      <table className="w-full text-sm">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-zinc-900 text-left text-xs font-semibold text-zinc-300">
                      {children}
                    </thead>
                  ),
                  th: ({ children }) => (
                    <th className="px-3 py-2">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="border-t border-zinc-700 px-3 py-2 text-zinc-300">
                      {children}
                    </td>
                  ),
                  hr: () => <hr className="my-3 border-zinc-700" />,
                }}
              >
                {displayContent}
              </ReactMarkdown>
            </div>
            <SourcesList sources={sources} />
            </>
          )
        ) : (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400" />
            Researching...
          </div>
        )}
      </div>
    </div>
  );
}
