"use client";

import { useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { YearlyData } from "@/lib/stats";

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}分`;
  return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`;
}

interface Props {
  data: YearlyData[];
}

export function YearlyChart({ data }: Props) {
  const chartData = data.map((d) => ({
    ...d,
    hours: Math.round(d.totalMinutes / 60),
  }));

  const CustomTooltip = useCallback(
    ({ active, payload }: { active?: boolean; payload?: Array<{ payload: YearlyData }> }) => {
      if (!active || !payload?.length) return null;
      const d = payload[0].payload;
      return (
        <div className="bg-card-bg border border-card-border rounded px-3 py-2 shadow text-sm">
          <p className="font-medium">{d.year}年</p>
          <p className="text-muted">{formatMinutes(d.totalMinutes)}</p>
        </div>
      );
    },
    []
  );

  return (
    <div className="h-64 sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            tickFormatter={(v: string) => `${v}年`}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `${v}h`}
            width={45}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="hours"
            stroke="var(--color-accent)"
            strokeWidth={2.5}
            dot={{ fill: "var(--color-accent)", r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
