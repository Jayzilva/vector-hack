"use client";

interface Score {
  category: string;
  score: number;
  sentiment: string;
  detail: string;
}

interface SentimentScorecardProps {
  data: {
    title: string;
    scores: Score[];
  };
}

const sentimentStyles: Record<
  string,
  { bg: string; bar: string; text: string; label: string }
> = {
  positive: {
    bg: "bg-green-500/10",
    bar: "bg-green-500",
    text: "text-green-400",
    label: "Positive",
  },
  negative: {
    bg: "bg-red-500/10",
    bar: "bg-red-500",
    text: "text-red-400",
    label: "Negative",
  },
  mixed: {
    bg: "bg-yellow-500/10",
    bar: "bg-yellow-500",
    text: "text-yellow-400",
    label: "Mixed",
  },
  neutral: {
    bg: "bg-zinc-500/10",
    bar: "bg-zinc-500",
    text: "text-zinc-400",
    label: "Neutral",
  },
};

export default function SentimentScorecard({
  data,
}: SentimentScorecardProps) {
  return (
    <div className="grid gap-2">
      {data.scores.map((score) => {
        const style = sentimentStyles[score.sentiment] ?? sentimentStyles.neutral;
        const pct = Math.min(Math.max((score.score / 10) * 100, 0), 100);

        return (
          <div
            key={score.category}
            className={`rounded-lg border border-zinc-700 p-3 ${style.bg}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-zinc-200">
                {score.category}
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${style.text}`}>
                  {score.score}/10
                </span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase ${style.bg} ${style.text} border border-current/20`}
                >
                  {style.label}
                </span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-700 mb-1.5">
              <div
                className={`h-full rounded-full ${style.bar} transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {score.detail}
            </p>
          </div>
        );
      })}
    </div>
  );
}
