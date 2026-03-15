"use client";

import { ArrowRight } from "lucide-react";

interface FollowUpChipsProps {
  questions: string[];
  onSelect: (question: string) => void;
  disabled?: boolean;
}

export default function FollowUpChips({
  questions,
  onSelect,
  disabled,
}: FollowUpChipsProps) {
  if (questions.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        Dig deeper
      </p>
      <div className="flex flex-wrap gap-2">
        {questions.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onSelect(q)}
            disabled={disabled}
            className="group flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
          >
            <span>{q}</span>
            <ArrowRight className="h-3 w-3 shrink-0 text-zinc-600 transition-colors group-hover:text-blue-400" />
          </button>
        ))}
      </div>
    </div>
  );
}
