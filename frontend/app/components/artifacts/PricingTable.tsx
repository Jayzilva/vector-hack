"use client";

import { Check, X } from "lucide-react";

interface PricingEntry {
  name: string;
  model: string;
  starting_price: string;
  enterprise_price: string;
  free_tier: boolean;
}

interface PricingTableProps {
  data: {
    title: string;
    competitors: PricingEntry[];
  };
}

const modelColors: Record<string, string> = {
  "per-seat": "bg-blue-500/20 text-blue-400",
  "usage-based": "bg-purple-500/20 text-purple-400",
  flat: "bg-green-500/20 text-green-400",
  freemium: "bg-amber-500/20 text-amber-400",
};

export default function PricingTable({ data }: PricingTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-700">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-zinc-800 text-left text-zinc-400">
            <th className="px-3 py-2 font-medium">Company</th>
            <th className="px-3 py-2 font-medium">Model</th>
            <th className="px-3 py-2 font-medium">Starting</th>
            <th className="px-3 py-2 font-medium">Enterprise</th>
            <th className="px-3 py-2 font-medium text-center">Free Tier</th>
          </tr>
        </thead>
        <tbody>
          {data.competitors.map((comp) => (
            <tr
              key={comp.name}
              className="border-t border-zinc-700/50 hover:bg-zinc-800/30 transition-colors"
            >
              <td className="px-3 py-2.5 font-medium text-zinc-200">
                {comp.name}
              </td>
              <td className="px-3 py-2.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    modelColors[comp.model] ?? "bg-zinc-700 text-zinc-300"
                  }`}
                >
                  {comp.model}
                </span>
              </td>
              <td className="px-3 py-2.5 text-zinc-300 font-mono">
                {comp.starting_price}
              </td>
              <td className="px-3 py-2.5 text-zinc-300 font-mono">
                {comp.enterprise_price}
              </td>
              <td className="px-3 py-2.5 text-center">
                {comp.free_tier ? (
                  <Check className="h-3.5 w-3.5 text-green-400 mx-auto" />
                ) : (
                  <X className="h-3.5 w-3.5 text-zinc-600 mx-auto" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
