"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Cpu } from "lucide-react";

interface Model {
  id: string;
  label: string;
  provider: string;
}

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
}

export default function ModelSelector({
  selectedModel,
  onModelChange,
  disabled,
}: ModelSelectorProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("http://localhost:8000/api/models")
      .then((r) => r.json())
      .then((data) => {
        setModels(data.models || []);
        if (!selectedModel && data.default) {
          onModelChange(data.default);
        }
      })
      .catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current = models.find((m) => m.id === selectedModel);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
      >
        <Cpu className="h-3 w-3" />
        <span>{current?.label || selectedModel || "Model"}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-52 rounded-xl border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
          {models.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onModelChange(m.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                m.id === selectedModel
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              <Cpu className="h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{m.label}</p>
                <p className="text-[10px] text-zinc-600">{m.provider}</p>
              </div>
              {m.id === selectedModel && (
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
