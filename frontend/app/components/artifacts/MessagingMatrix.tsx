"use client";

interface MatrixEntry {
  name: string;
  official_positioning: string;
  user_perception: string;
  gap: string;
}

interface MessagingMatrixProps {
  data: {
    title: string;
    competitors: MatrixEntry[];
  };
}

const gapStyles: Record<string, { bg: string; text: string }> = {
  high: { bg: "bg-red-500/20", text: "text-red-400" },
  medium: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  low: { bg: "bg-green-500/20", text: "text-green-400" },
  aligned: { bg: "bg-blue-500/20", text: "text-blue-400" },
};

export default function MessagingMatrix({ data }: MessagingMatrixProps) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="grid grid-cols-[1fr_2fr_2fr_auto] gap-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500 px-3">
        <span>Company</span>
        <span>Official Positioning</span>
        <span>User Perception</span>
        <span>Gap</span>
      </div>

      {data.competitors.map((entry) => {
        const style = gapStyles[entry.gap] ?? gapStyles.medium;

        return (
          <div
            key={entry.name}
            className="grid grid-cols-[1fr_2fr_2fr_auto] gap-2 rounded-lg border border-zinc-700 bg-zinc-800/30 p-3 items-start"
          >
            <span className="text-xs font-medium text-zinc-200">
              {entry.name}
            </span>
            <div className="text-xs text-zinc-400 leading-relaxed">
              <div className="rounded bg-zinc-700/30 px-2 py-1.5">
                {entry.official_positioning}
              </div>
            </div>
            <div className="text-xs text-zinc-400 leading-relaxed">
              <div className="rounded bg-zinc-700/30 px-2 py-1.5">
                {entry.user_perception}
              </div>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${style.bg} ${style.text} shrink-0`}
            >
              {entry.gap}
            </span>
          </div>
        );
      })}
    </div>
  );
}
