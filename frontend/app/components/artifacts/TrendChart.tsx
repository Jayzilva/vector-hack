"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Signal {
  label: string;
  value: number;
  category: string;
}

interface TrendChartProps {
  data: {
    title: string;
    trend_direction: string;
    signals: Signal[];
  };
}

const trendIcons: Record<string, React.ReactNode> = {
  growing: <TrendingUp className="h-4 w-4 text-green-400" />,
  declining: <TrendingDown className="h-4 w-4 text-red-400" />,
  stable: <Minus className="h-4 w-4 text-yellow-400" />,
};

const trendColors: Record<string, string> = {
  growing: "text-green-400",
  declining: "text-red-400",
  stable: "text-yellow-400",
};

const barColors = [
  "#3b82f6",
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#6366f1",
];

export default function TrendChart({ data }: TrendChartProps) {
  const direction = data.trend_direction || "stable";

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {trendIcons[direction]}
        <span
          className={`text-xs font-medium uppercase tracking-wider ${
            trendColors[direction] ?? "text-zinc-400"
          }`}
        >
          Market {direction}
        </span>
      </div>

      {data.signals.length > 0 && (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.signals}
              layout="vertical"
              margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
            >
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fill: "#71717a", fontSize: 10 }}
                axisLine={{ stroke: "#3f3f46" }}
                tickLine={false}
              />
              <YAxis
                dataKey="label"
                type="category"
                width={120}
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#e4e4e7",
                }}
                formatter={(value) => [`${value}/100`, "Strength"]}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                {data.signals.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={barColors[index % barColors.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
